#!/usr/bin/env python3
"""Hooks UserPromptSubmit и SubagentStart: напоминание пройти по списку скилов. Сабагенту UserPromptSubmit не приходит, поэтому то же напоминание - на его старте. Текст не зависит от кита и проекта.
Замеры - bench/results/2026-11-17-sonnet-hook-descriptions.md."""
import json
import sys

TEXT = (
    "Перед любым другим действием пройди по списку доступных скилов. По описанию каждого реши, подходит ли он "
    "к этой задаче. Каждый подходящий открой инструментом Skill сейчас, до чтения файлов и правок."
)


def event_name():
    """Имя события из входа hook: ответ должен его повторить, иначе Claude Code текст не примет."""
    try:
        return json.loads(sys.stdin.read()).get("hook_event_name") or "UserPromptSubmit"
    except ValueError:
        return "UserPromptSubmit"


print(json.dumps({"hookSpecificOutput": {"hookEventName": event_name(), "additionalContext": TEXT}}, ensure_ascii=False))
