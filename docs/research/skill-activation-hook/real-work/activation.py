"""Доля активации скилов в основных сессиях upcore до и после хука skill-check (17.11).

Два вида доли:
- от всех сессий репозитория (бэк или фронт: у них разные киты);
- от сессий, где был повод открыть скил (правка .cs, правка теста, сборка, запрос к базе и т. п.).

chat-reply: окно 30.10-12.11, когда скила не было в списке доступных, из знаменателя исключено.
Запуск: python3 activation.py <копия switchyard.db>
"""
import collections
import datetime as dt
import json
import math
import re
import sqlite3
import sys

HOOK_DAY = "2026-11-17"
CHAT_REPLY_GAP = ("2026-10-30", "2026-11-12")
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

SEARCH = re.compile(r"\b(rg|grep|fdfind|sed -n|cat|head)\b")


def kiev_day(iso):
    return (dt.datetime.fromisoformat(iso.replace("Z", "+00:00")) + dt.timedelta(hours=2)).date().isoformat()


def load(db):
    sessions = {}
    for sid, first, repo in db.execute(
        """SELECT t.session_id, MIN(t.started_at), s.repo FROM trace_turns t JOIN trace_sessions s ON s.id = t.session_id
           WHERE s.kind = 'session' AND s.repo IN (?, ?) GROUP BY 1""", REPOS):
        sessions[sid] = {"day": kiev_day(first), "repo": repo, "skills": set(), "why": set()}
    for sid, tool, target, parent in db.execute("SELECT session_id, tool, target, parent FROM trace_calls"):
        s = sessions.get(sid)
        if s is None or not target:
            continue
        if tool == "Skill":
            if parent is None:
                s["skills"].add(target.split(":")[-1])
            continue
        if parent is not None:
            continue
        mark(s["why"], tool, target)
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


def period(day):
    return "after" if day >= HOOK_DAY else "before"


def in_base(skill, day):
    return not (skill == "claude-rules-chat-reply" and CHAT_REPLY_GAP[0] <= day <= CHAT_REPLY_GAP[1])


def table(sessions):
    rows = []
    skills = sorted({k for s in sessions.values() for k in s["skills"]})
    for repo in REPOS:
        group = [s for s in sessions.values() if s["repo"] == repo]
        for skill in skills:
            row = {"repo": repo, "skill": skill}
            for p in ("before", "after"):
                base = [s for s in group if period(s["day"]) == p and in_base(skill, s["day"])]
                hit = [s for s in base if skill in s["skills"]]
                row[p] = (len(hit), len(base))
                trig = SKILL_TRIGGER.get(skill)
                if trig:
                    tb = [s for s in base if trig in s["why"]]
                    row[p + "_trig"] = (sum(skill in s["skills"] for s in tb), len(tb))
            if row["before"][0] + row["after"][0] >= 3:
                rows.append(row)
    return rows


def shift_p(before, after):
    """Односторонняя биномиальная: как часто сдвиг не меньше наблюдаемого выходит случайно при доле до хука."""
    (hb, nb), (ha, na) = before, after
    if not nb or not na:
        return None
    p0 = hb / nb
    prob = lambda i: math.comb(na, i) * p0 ** i * (1 - p0) ** (na - i)
    up = sum(prob(i) for i in range(ha, na + 1))
    down = sum(prob(i) for i in range(0, ha + 1))
    return min(up, down)


def main():
    db = sqlite3.connect(sys.argv[1])
    rows = table(load(db))
    json.dump(rows, open("activation.json", "w"), ensure_ascii=False, indent=1)
    pct = lambda h, n: f"{100 * h / n:3.0f}% ({h}/{n})" if n else "   -"
    for r in sorted(rows, key=lambda r: (r["repo"], -(r["after"][0] / max(r["after"][1], 1) - r["before"][0] / max(r["before"][1], 1)))):
        trig = SKILL_TRIGGER.get(r["skill"], "")
        pv = shift_p(r["before"], r["after"])
        t0 = f" p={pv:.4f}" if pv is not None else ""
        t = f" | при поводе «{TRIGGERS[trig]}»: {pct(*r['before_trig'])} -> {pct(*r['after_trig'])}" if trig else ""
        print(f"{r['repo'][7:12]} {r['skill'][13:]:24} {pct(*r['before'])} -> {pct(*r['after'])}{t0}{t}")


if __name__ == "__main__":
    main()
