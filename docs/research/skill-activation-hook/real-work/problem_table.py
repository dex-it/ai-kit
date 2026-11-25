"""Таблица «Проблема»: открывают ли скилы кита основные сессии и сабагенты upcore до хука (01.10-16.11).

По каждому транскрипту (основному и сабагента): модель, скилы claude-rules-* из его skill_listing, открытые им Skill.
Выгрузка problem.csv: session,agent,model,skill,listed,opened (строка на скил из списка).
Запуск: python3 problem_table.py [копия switchyard.db]  (по умолчанию ~/.switchyard/switchyard.db)
"""
import collections
import csv
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # python -I не добавляет каталог скрипта
import traces

FROM_DAY, TO_DAY = "2026-10-01", min("2026-11-16", traces.END_DAY)
REPOS = ("upcore.backend", "upcore.frontend")
KIT = "claude-rules-"


def top_model(db, sid, parent):
    """Модель, которой чаще всего вызывались инструменты агента (parent=None - основной сессии)."""
    rows = db.execute("SELECT model FROM trace_calls WHERE session_id = ? AND parent IS ? AND model IS NOT NULL", (sid, parent)).fetchall()
    counts = collections.Counter(row[0] for row in rows)
    return counts.most_common(1)[0][0] if counts else None


def family(model):
    """Семейство модели: в meta сабагента бывает короткое имя (haiku), в trace_calls - полное (claude-haiku-5-5)."""
    return next((name for name in ("haiku", "sonnet", "opus") if name in model), model)


def transcripts(db, sid, sources, session_models):
    """(agent, model, текст) основного транскрипта и каждого сабагента; None вместо текста, если архива нет."""
    main = traces.main_raws(sid, sources)
    if main is None:
        return None
    result = [("main", top_model(db, sid, None) or (session_models or ["?"])[0], "\n".join(main))]
    metas = {s["agent"]: s for s in json.loads(sources) if s.get("kind") == "meta"}
    for src in traces.sources_of(sources, agent=True):
        meta = {}
        if src["agent"] in metas:
            path = os.path.join(traces.TRACES, sid, metas[src["agent"]]["file"])
            if os.path.isfile(path):
                meta = json.load(open(path, encoding="utf-8"))
        text = traces.raw(sid, src)
        if text is None:
            continue
        result.append((src["agent"], top_model(db, sid, meta.get("toolUseId")) or meta.get("model") or "?", text))
    return result


def main():
    traces.need_zstd()
    db = sqlite3.connect(os.path.expanduser(sys.argv[1]) if len(sys.argv) > 1 else os.path.expanduser("~/.switchyard/switchyard.db"))
    stats, agent_stats = traces.ListingStats(), traces.ListingStats()  # списки основных сессий и сабагентов
    records = []  # (session, agent, model, listed, opened-по-транскрипту)
    no_listing = collections.Counter()
    no_archive = after_hook = used = 0
    for sid, first, sources, models in db.execute(
        """SELECT t.session_id, MIN(t.started_at), s.sources, s.models FROM trace_turns t JOIN trace_sessions s ON s.id = t.session_id
           WHERE s.kind = 'session' AND s.repo IN (?, ?) GROUP BY 1 ORDER BY 2""", REPOS):
        if not FROM_DAY <= traces.kiev_day(first) <= TO_DAY:
            continue
        found = transcripts(db, sid, sources, json.loads(models or "[]"))
        if found is None:
            no_archive += 1
            continue
        if traces.scan(found[0][2])[0]:
            after_hook += 1
            continue
        used += 1
        for agent, model, text in found:
            listed = {name for name in traces.scan(text, stats if agent == "main" else agent_stats)[1] if name.startswith(KIT)}
            if not listed:
                no_listing["main" if agent == "main" else "agent"] += 1
                continue
            records.append((sid, agent, model, listed, traces.opened_skills(text)))
    names = traces.Names()
    for _, _, _, listed, opened in records:
        names.add(listed, opened)
    names.build()
    main_skills = collections.defaultdict(lambda: [0, 0])  # skill -> [открыт, в списке] по основным сессиям
    by_model = collections.defaultdict(lambda: [0, 0])  # модель -> [открыли хоть один, всего со списком] по сабагентам
    with open("problem.csv", "w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(["session", "agent", "model", "skill", "listed", "opened"])
        for sid, agent, model, listed, opened in records:
            listed = names.apply((sid, agent), listed)
            opened = {names.full(name) for name in opened} & listed
            for skill in sorted(listed):
                writer.writerow([sid, agent, model, skill, 1, int(skill in opened)])
            if agent == "main":
                for skill in listed:
                    main_skills[skill][1] += 1
                    main_skills[skill][0] += skill in opened
            else:
                by_model[family(model)][1] += 1
                by_model[family(model)][0] += bool(opened)
    print("основные сессии:", end=" ")
    stats.report()
    print("сабагенты:", end=" ")
    agent_stats.report()
    names.report()
    print(f"основных сессий {used} ({FROM_DAY} - {TO_DAY}, без хука); без архива {no_archive}; с хуком в этом окне {after_hook} (исключены)")
    print("\n(а) основные сессии: скил открыт / в списке")
    for skill, (opened, listed) in sorted(main_skills.items(), key=lambda item: (-item[1][0] / item[1][1], item[0])):
        print(f"{opened:4}/{listed:<4} {100 * opened / listed:3.0f}%  {skill[len(KIT):]}")
    print("\n(б) сабагенты: открыли хоть один скил кита / было в списке, по модели")
    for model, (opened, listed) in sorted(by_model.items()):
        print(f"{model:24} {opened}/{listed}")
    print(f"список не найден: основных {no_listing['main']}, сабагентов {no_listing['agent']}")


if __name__ == "__main__":
    main()
