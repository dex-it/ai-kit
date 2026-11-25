"""Доля активации скилов в основных сессиях upcore до и после хука skill-check.

Период сессии - по записи хука в её транскрипте (UserPromptSubmit с напоминанием), не по дате. Сверка с датой 17.11 печатается.
Два вида доли:
- от сессий репозитория (бэк или фронт: у них разные киты), где скил был в списке доступных (skill_listing основной сессии);
- от сессий, где был повод открыть скил (правка .cs, правка теста, сборка, запрос к базе и т. п.).

Рост после хука проверяется точным критерием Фишера (односторонний), поправка на множественность - Холм.
Запуск: python3 activation.py [копия switchyard.db]  (по умолчанию ~/.switchyard/switchyard.db)
"""
import datetime as dt
import json
import math
import os
import re
import sqlite3
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # python -I не добавляет каталог скрипта
import traces

HOOK_DATE = "2026-11-17"  # дата выкладки хука: только для сверки с признаком по транскрипту
ALPHA = 0.05
REPOS = ("upcore.backend", "upcore.frontend")

TRIGGERS = {
    "cs_edit": "правка .cs",
    "test_edit": "правка теста (.cs в *Tests*)",
    "migration_edit": "правка миграции",
    "front_edit": "правка .ts/.tsx",
    "any_edit": "любая правка файла",
    "build": "dotnet build/test",
    "db": "запрос к базе (psql)",
    "search": "поиск/чтение кода",
    "gitlab": "glab или ссылка на GitLab",
    "subagent": "запуск сабагента",
}

# скил -> повод, при котором его ждём
SKILL_TRIGGER = {
    "claude-rules-code-writing": "any_edit",
    "claude-rules-code-general": "any_edit",
    "claude-rules-csharp-code": "cs_edit",
    "claude-rules-upcore-code": "cs_edit",
    "claude-rules-csharp-xml-docs": "cs_edit",
    "claude-rules-csharp-dto-records": "cs_edit",
    "claude-rules-csharp-tests": "test_edit",
    "claude-rules-upcore-tests": "test_edit",
    "claude-rules-csharp-ef-migrations": "migration_edit",
    "claude-rules-upcore-ef": "cs_edit",
    "claude-rules-upcore-build": "build",
    "claude-rules-postgres-reader": "db",
    "claude-rules-code-search": "search",
    "claude-rules-gitlab": "gitlab",
    "claude-rules-ui-craft": "front_edit",
    "claude-rules-visual-check": "front_edit",
}

EDIT_TOOLS = ("Edit", "Write", "MultiEdit")
EDIT_TRIGGERS = {"any_edit", "cs_edit", "test_edit"}
LENGTH_GROUPS = ((1, 3), (4, 8), (9, 10 ** 9))

SEARCH = re.compile(r"\b(rg|grep|fdfind|sed -n|cat|head)\b")


def load(db, names=None, stats=None):
    """Сессии с признаками. hook/listed = None, если у сессии нет архива транскрипта."""
    sessions = {}
    for sid, first, repo, sources, turns in db.execute(
        """SELECT t.session_id, MIN(t.started_at), s.repo, s.sources, s.turns FROM trace_turns t JOIN trace_sessions s ON s.id = t.session_id
           WHERE s.kind = 'session' AND s.repo IN (?, ?) GROUP BY 1""", REPOS):
        if traces.kiev_day(first) > traces.END_DAY:
            continue
        s = {"day": traces.kiev_day(first), "repo": repo, "skills": set(), "why": set(), "hook": None, "listed": None,
             "turns": turns, "calls": 0, "first_turn": None, "pos": {}, "edit_pos": {}}
        texts = traces.main_raws(sid, sources)
        if texts is not None:
            s["hook"], s["listed"] = False, set()
            for text in texts:
                hook, listed = traces.scan(text, stats)
                s["hook"] = s["hook"] or hook
                s["listed"] |= listed
        sessions[sid] = s
    for sid, tool, target, parent, turn, n in db.execute("SELECT session_id, tool, target, parent, turn, n FROM trace_calls"):
        s = sessions.get(sid)
        if s is None:
            continue
        if parent is None:
            s["calls"] += 1
            s["first_turn"] = turn if s["first_turn"] is None else min(s["first_turn"], turn)
        if not target:
            continue
        if tool == "Skill":
            if parent is None:
                name = target.split(":")[-1]
                s["skills"].add(name)
                s["pos"][name] = min(s["pos"].get(name, (turn, n)), (turn, n))
            continue
        if parent is not None:
            continue
        mark(s["why"], tool, target)
        if tool in EDIT_TOOLS:
            found = set()
            mark(found, tool, target)
            for trig in found & EDIT_TRIGGERS:
                s["edit_pos"][trig] = min(s["edit_pos"].get(trig, (turn, n)), (turn, n))
    names = names or traces.Names()
    for s in sessions.values():
        names.add(s["listed"] or set(), s["skills"])
    names.build()
    for sid, s in sessions.items():
        if s["listed"] is not None:
            s["listed"] = names.apply(sid, s["listed"])
        s["skills"] = {names.full(name) for name in s["skills"]}
        s["pos"] = {names.full(name): pos for name, pos in s["pos"].items()}
    return sessions


def mark(why, tool, target):
    if tool in ("Edit", "Write", "MultiEdit"):
        why.add("any_edit")
        if target.endswith(".cs"):
            why.add("cs_edit")
            if "Tests" in target:
                why.add("test_edit")
            if "/Migrations/" in target:
                why.add("migration_edit")
        if target.endswith((".ts", ".tsx")):
            why.add("front_edit")
    elif tool in ("Read", "Grep", "Glob"):
        why.add("search")
    elif tool == "Bash":
        if "dotnet build" in target or "dotnet test" in target:
            why.add("build")
        if "psql" in target:
            why.add("db")
        if "glab" in target or "git.dextechnology.com" in target:
            why.add("gitlab")
        if SEARCH.search(target):
            why.add("search")
    elif tool in ("Agent", "Task"):
        why.add("subagent")


def period(session):
    return "after" if session["hook"] else "before"


def table(sessions):
    rows = []
    skills = sorted({k for s in sessions.values() for k in s["skills"]})
    for repo in REPOS:
        group = [s for s in sessions.values() if s["repo"] == repo and s["hook"] is not None]
        for skill in skills:
            row = {"repo": repo, "skill": skill}
            for p in ("before", "after"):
                base = [s for s in group if period(s) == p and skill in s["listed"]]
                hit = [s for s in base if skill in s["skills"]]
                row[p] = (len(hit), len(base))
                trig = SKILL_TRIGGER.get(skill)
                if trig:
                    tb = [s for s in base if trig in s["why"]]
                    row[p + "_trig"] = (sum(skill in s["skills"] for s in tb), len(tb))
            if row["before"][0] + row["after"][0] >= 3:
                rows.append(row)
    return rows


def before_first_edit(sessions):
    """Открыт ли скил раньше первой правки подходящего файла: (скил, повод) -> до/после хука: (открыт до правки, только после правки, всего с поводом)."""
    pairs = [(skill, trig) for skill, trig in SKILL_TRIGGER.items() if trig in EDIT_TRIGGERS]
    pairs += [(skill, "cs_edit") for skill, trig in SKILL_TRIGGER.items() if trig == "any_edit"]  # code-writing/code-general и по правкам .cs
    result = []
    for skill, trig in pairs:
        row = {"skill": skill, "trigger": trig}
        for p in ("before", "after"):
            base = [s for s in sessions.values() if s["repo"] == REPOS[0] and s["hook"] is not None and period(s) == p
                    and skill in s["listed"] and trig in s["edit_pos"]]
            early = sum(skill in s["pos"] and s["pos"][skill] < s["edit_pos"][trig] for s in base)
            late = sum(skill in s["pos"] and s["pos"][skill] > s["edit_pos"][trig] for s in base)
            row[p] = (early, late, len(base))
        if row["before"][2] and row["after"][2]:
            row["p"] = fisher_up((row["before"][0], row["before"][2]), (row["after"][0], row["after"][2]))
            result.append(row)
    return result


def by_length(sessions, rows):
    """Для строк с итогом: открыт в первом ходе сессии и доля по группам длины сессии, до -> после хука."""
    result = []
    for r in rows:
        row = {"repo": r["repo"], "skill": r["skill"]}
        for p in ("before", "after"):
            base = [s for s in sessions.values() if s["repo"] == r["repo"] and s["hook"] is not None and period(s) == p and r["skill"] in s["listed"]]
            row[p + "_first_turn"] = (sum(r["skill"] in s["pos"] and s["pos"][r["skill"]][0] == s["first_turn"] for s in base), len(base))
            row[p + "_groups"] = {f"{lo}-{hi}" if hi < 10 ** 9 else f"{lo}+": (
                sum(r["skill"] in s["skills"] for s in base if lo <= s["turns"] <= hi), sum(lo <= s["turns"] <= hi for s in base))
                for lo, hi in LENGTH_GROUPS}
        result.append(row)
    return result


def medians(sessions):
    result = {}
    for repo in REPOS:
        for p in ("before", "after"):
            group = [s for s in sessions.values() if s["repo"] == repo and s["hook"] is not None and period(s) == p]
            result[f"{repo}.{p}"] = {"sessions": len(group), "calls": statistics.median(s["calls"] for s in group), "turns": statistics.median(s["turns"] for s in group)}
    return result


def fisher_up(before, after):
    """Точный критерий Фишера, односторонний на рост доли после хука: хвост гипергеометрического распределения таблицы 2x2."""
    (hb, nb), (ha, na) = before, after
    if not nb or not na:
        return None
    total, opened = nb + na, hb + ha
    tail = sum(math.comb(opened, x) * math.comb(total - opened, na - x) for x in range(ha, min(opened, na) + 1))
    return tail / math.comb(total, na)


def holm(pvalues, alpha=ALPHA):
    """Какие из проверок держатся по Холму: p по возрастанию против alpha / (m - i), остановка на первой непрошедшей. m - строки с посчитанным p."""
    order = sorted((i for i, p in enumerate(pvalues) if p is not None), key=lambda i: pvalues[i])
    m = len(order)
    held = set()
    for rank, i in enumerate(order):
        if pvalues[i] > alpha / (m - rank):
            break
        held.add(i)
    return held


def fmt_p(p):
    return "<0,00001" if p < 0.000005 else f"{p:.5f}".replace(".", ",")


def main():
    traces.need_zstd()
    db = sqlite3.connect(os.path.expanduser(sys.argv[1]) if len(sys.argv) > 1 else os.path.expanduser("~/.switchyard/switchyard.db"))
    names, stats = traces.Names(), traces.ListingStats()
    sessions = load(db, names, stats)
    archived = [s for s in sessions.values() if s["hook"] is not None]
    early_hook = sum(s["hook"] and s["day"] < HOOK_DATE for s in archived)
    late_nohook = sum(not s["hook"] and s["day"] >= HOOK_DATE for s in archived)
    print(f"сессий {len(sessions)}, без архива транскрипта {len(sessions) - len(archived)} (из таблицы исключены)")
    days = lambda hooked: sorted(s["day"] for s in archived if bool(s["hook"]) == hooked)
    print(f"окно: до хука: {days(False)[0]} - {days(False)[-1]}, после: {days(True)[0]} - {days(True)[-1]} (по Киеву, не позже {traces.END_DAY})")
    print(f"сверка хука с датой {HOOK_DATE}: до даты с хуком {early_hook}, с даты без хука {late_nohook}")
    stats.report()
    names.report()
    report(sessions, "activation.json")


def report(sessions, json_path):
    """Таблица, медианы, Холм, «до первой правки», длина сессии и json по готовым сессиям."""
    rows = table(sessions)
    med = medians(sessions)
    for repo in REPOS:
        b, a = med[f"{repo}.before"], med[f"{repo}.after"]
        print(f"медианы основной сессии {repo[7:12]} до -> после: вызовов {b['calls']:g} -> {a['calls']:g}, ходов {b['turns']:g} -> {a['turns']:g} (сессий {b['sessions']} -> {a['sessions']})")
    rows.sort(key=lambda r: (r["repo"], -(r["after"][0] / max(r["after"][1], 1) - r["before"][0] / max(r["before"][1], 1))))
    pvalues = [fisher_up(r["before"], r["after"]) for r in rows]
    held = holm(pvalues)
    m = sum(p is not None for p in pvalues)
    print(f"Фишер односторонний (рост после хука), поправка Холма: проверок m={m}, исключено строк без p {len(rows) - m}, уровень {str(ALPHA).replace('.', ',')}")
    pct = lambda h, n: f"{100 * h / n:3.0f}% ({h}/{n})" if n else "   -"
    verdicts = {}
    for i, r in enumerate(rows):
        trig = SKILL_TRIGGER.get(r["skill"], "")
        p = pvalues[i]
        verdict = "" if p is None or p >= ALPHA else "держится с поправкой" if i in held else "рост есть, с поправкой не доказан"
        verdicts[i] = verdict
        t0 = f" p={fmt_p(p)} {verdict}".rstrip() if p is not None else ""
        t = f" | при поводе «{TRIGGERS[trig]}»: {pct(*r['before_trig'])} -> {pct(*r['after_trig'])}" if trig else ""
        print(f"{r['repo'][7:12]} {r['skill'][13:]:24} {pct(*r['before'])} -> {pct(*r['after'])}{t0}{t}")

    early = before_first_edit(sessions)
    print("\nОткрыт до первой правки (только бэкенд, без поправки на множественность, в Холма не входит)")
    for r in early:
        (b, bl, bn), (a, al, an) = r["before"], r["after"]
        print(f"{r['skill'][13:]:24} повод «{TRIGGERS[r['trigger']]}»: открыт до правки {b}/{bn} -> {a}/{an}, только после {bl} -> {al}, p={fmt_p(r['p'])} (без поправки)")
    shown = [r for i, r in enumerate(rows) if verdicts[i]]
    lengths = by_length(sessions, shown)
    print("\nДлина сессии для строк с итогом (без p): (а) открыт в первом ходе; (б) доля открытия по числу ходов сессии")
    for r in lengths:
        groups = " | ".join(f"{g}: {pct(*r['before_groups'][g])} -> {pct(*r['after_groups'][g])}" for g in r["before_groups"])
        print(f"{r['repo'][7:12]} {r['skill'][13:]:24} 1-й ход: {pct(*r['before_first_turn'])} -> {pct(*r['after_first_turn'])} | ходов {groups}")
    json.dump({"rows": rows, "medians": med, "before_first_edit": early, "by_length": lengths}, open(json_path, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
