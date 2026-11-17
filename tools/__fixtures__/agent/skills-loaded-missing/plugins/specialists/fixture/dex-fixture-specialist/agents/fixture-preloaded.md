---
name: fixture-preloaded
description: >-
  Фикстура fixture-preloaded для правила skills-loaded-missing.
  Триггеры - фикстура загрузки skills, прогон правила валидатора, регрессия валидатора.
tools: Read, Write, Grep, Glob, Skill
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
---

# fixture-preloaded

Агент существует ради фикстуры: загрузка skill уже загружен заранее и от пропуска не страдает, а след загрузки в выходе не назван.

## Phase 1: Intake

**Goal:** Принять вход песочницы и назвать, чего в нём нет.

**Input (handoff):** `[blocking]` предмет прогона; `[default-ok]` режим (дефолт `autonomous`).

Контракт стыка - в pre-loaded `dex-skill-node-contract:node-contract`: поля и правило стыка берутся оттуда.

**Exit criteria:** Предмет назван, нехватка входа зафиксирована списком либо список пуст.

## Phase 2: Report

**Goal:** Отдать результат вызывающему.

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), перечень находок, допущения.

**Exit criteria:** Output содержит `status` и перечень находок; пустой перечень назван явно.
