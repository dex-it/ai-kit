---
name: fixture-word
description: >-
  Фикстура fixture-word для правила skills-loaded-missing.
  Триггеры - фикстура загрузки skills, прогон правила валидатора, регрессия валидатора.
tools: Read, Write, Grep, Glob, Skill
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
---

# fixture-word

Агент существует ради фикстуры: загрузка skill велена словом без адреса, а след загрузки в выходе не назван.

## Phase 1: Intake

**Goal:** Принять вход песочницы и назвать, чего в нём нет.

**Input (handoff):** `[blocking]` предмет прогона; `[default-ok]` режим (дефолт `autonomous`).

Если предмет задевает фикстуру - загрузи нужный skill через Skill tool.

**Exit criteria:** Предмет назван, нехватка входа зафиксирована списком либо список пуст.

## Phase 2: Report

**Goal:** Отдать результат вызывающему.

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), перечень находок, допущения.

**Exit criteria:** Output содержит `status` и перечень находок; пустой перечень назван явно.
