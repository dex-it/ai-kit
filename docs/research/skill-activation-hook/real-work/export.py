"""Выгрузка сырых данных реальной работы из копии базы Switchyard в CSV.

sessions.csv - одна строка на основную сессию проекта: день (Киев), период, ходы, вызовы, открытые
скилы, действия, по которым считается «скил был нужен», и писались ли строки `///`.
subagent-runs.csv - одна строка на прогон сабагента: вид прогона и открытые им скилы.

Имена задач, тексты промптов и описания прогонов не выгружаются: в них имена рабочего проекта.
Запуск: python3 export.py <копия switchyard.db>  (флаг `///` читает архивы транскриптов из ~/.switchyard/traces)
"""
import csv
import sys

from activation import HOOK_DATE, load, period
from xmldocs import wrote_xml

import sqlite3

EXECUTOR_WORDS = ("Наряд", "Реализация", "Исполнитель", "Тесты", "Правки")
REVIEW_WORDS = ("Ревью", "Review", "ревью")


def run_kind(target):
    agent_type, _, description = (target or "").partition(":")
    if agent_type.strip() == "Explore":
        return "explore"
    if any(word in description for word in EXECUTOR_WORDS):
        return "executor"
    if any(word in description for word in REVIEW_WORDS):
        return "reviewer"
    return "other"


def export_sessions(db, sessions):
    with open("sessions.csv", "w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(["session", "repo", "day", "period", "turns", "calls", "skills", "actions", "wrote_xml_doc"])
        for sid, s in sorted(sessions.items(), key=lambda item: item[1]["day"]):
            turns, calls, sources = db.execute("SELECT turns, calls, sources FROM trace_sessions WHERE id = ?", (sid,)).fetchone()
            xml = wrote_xml(sid, sources) if "cs_edit" in s["why"] else False
            writer.writerow([sid, s["repo"], s["day"], "" if s["hook"] is None else period(s), turns, calls,
                             " ".join(sorted(s["skills"])), " ".join(sorted(s["why"])),
                             "" if xml is None else int(xml)])


def export_runs(db, sessions):
    with open("subagent-runs.csv", "w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(["session", "run", "day", "period", "kind", "skills"])
        for sid, run_id, target in db.execute("SELECT session_id, id, target FROM trace_calls WHERE tool IN ('Agent', 'Task') ORDER BY started_at"):
            s = sessions.get(sid)
            if s is None:
                continue
            skills = sorted({row[0].split(":")[-1] for row in db.execute(
                "SELECT DISTINCT target FROM trace_calls WHERE session_id = ? AND parent = ? AND tool = 'Skill' AND target IS NOT NULL", (sid, run_id))})
            writer.writerow([sid, run_id, s["day"], "" if s["hook"] is None else period(s), run_kind(target), " ".join(skills)])


def main():
    db = sqlite3.connect(sys.argv[1])
    sessions = load(db)
    export_sessions(db, sessions)
    export_runs(db, sessions)
    print("hook date", HOOK_DATE, "sessions", len(sessions))


main()
