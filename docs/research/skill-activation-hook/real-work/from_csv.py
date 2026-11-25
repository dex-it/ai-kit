"""Те же числа реальной работы, что считает activation.py, но из CSV в репозитории: без базы Switchyard и без архивов транскриптов.

Что считает: отчёт activation.py (таблица доли открытия до и после хука, медианы, Холм, «до первой правки», длина сессии),
таблицу «Проблема» из problem.csv (как problem_table.py, разделы а и б) и открытие csharp-xml-docs в сессиях бэкенда,
где писали `///`.
Что нужно: только sessions.csv и problem.csv рядом со скриптом, стандартная библиотека.
Чем отличается от activation.py: нет разбора транскриптов, сверки хука с датой и сводки сокращённых имён скилов -
период, список доступных скилов и полные имена уже лежат в sessions.csv. Файлов не пишет, только печатает.
Запуск: python3 from_csv.py
"""
import collections
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # python -I не добавляет каталог скрипта
import activation
from problem_table import KIT, family

HERE = os.path.dirname(os.path.abspath(__file__))


def positions(text):
    result = {}
    for item in text.split():
        name, _, pos = item.rpartition("@")
        turn, _, n = pos.partition(".")
        result[name] = (int(turn), int(n))
    return result


def load_sessions(path):
    sessions = {}
    with open(path, newline="", encoding="utf-8") as src:
        for row in csv.DictReader(src):
            sessions[row["session"]] = {
                "day": row["day"], "repo": row["repo"], "skills": set(row["skills"].split()), "why": set(row["actions"].split()),
                "hook": {"before": False, "after": True}.get(row["period"]),
                "listed": set(row["listed"].split()) if row["period"] else None,
                "turns": int(row["turns"]), "calls": int(row["main_calls"]),
                "first_turn": int(row["first_turn"]) if row["first_turn"] else None,
                "pos": positions(row["skill_pos"]), "edit_pos": positions(row["edit_pos"]),
                "wrote_xml": row["wrote_xml_doc"] == "1"}
    return sessions


def problem_table(path):
    main_skills = collections.defaultdict(lambda: [0, 0])
    agents = {}  # (сессия, агент) -> [модель, открыл хоть один скил]
    with open(path, newline="", encoding="utf-8") as src:
        for row in csv.DictReader(src):
            opened = int(row["opened"])
            if row["agent"] == "main":
                main_skills[row["skill"]][1] += 1
                main_skills[row["skill"]][0] += opened
            else:
                agent = agents.setdefault((row["session"], row["agent"]), [family(row["model"]), 0])
                agent[1] |= opened
    by_model = collections.defaultdict(lambda: [0, 0])
    for model, opened in agents.values():
        by_model[model][1] += 1
        by_model[model][0] += opened
    print("\n(а) основные сессии: скил открыт / в списке")
    for skill, (opened, listed) in sorted(main_skills.items(), key=lambda item: (-item[1][0] / item[1][1], item[0])):
        print(f"{opened:4}/{listed:<4} {100 * opened / listed:3.0f}%  {skill[len(KIT):]}")
    print("\n(б) сабагенты: открыли хоть один скил кита / было в списке, по модели")
    for model, (opened, listed) in sorted(by_model.items()):
        print(f"{model:24} {opened}/{listed}")


def xml_docs(sessions):
    counts = {p: [0, 0] for p in (False, True)}
    for s in sessions.values():
        if s["repo"] == "upcore.backend" and s["wrote_xml"] and s["hook"] is not None:
            counts[s["hook"]][1] += 1
            counts[s["hook"]][0] += "claude-rules-csharp-xml-docs" in s["skills"]
    (a, b), (c, d) = counts[False], counts[True]
    print(f"csharp-xml-docs при записи ///: до {a}/{b} -> после {c}/{d}")


def main():
    sessions = load_sessions(os.path.join(HERE, "sessions.csv"))
    archived = [s for s in sessions.values() if s["hook"] is not None]
    print(f"сессий {len(sessions)}, без архива транскрипта {len(sessions) - len(archived)} (из таблицы исключены)")
    activation.report(sessions)
    problem_table(os.path.join(HERE, "problem.csv"))
    print()
    xml_docs(sessions)


if __name__ == "__main__":
    main()
