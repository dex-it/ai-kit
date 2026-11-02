---
title: Типичные ошибки валидаторов
description: Как читать вывод валидаторов каталога и что делать с самыми частыми правилами - skills, агенты, команды, бандлы, витрина, терминология - с расшифровкой причин и способом исправить.
---

Валидатор печатает имя правила в квадратных скобках: `ERROR [no-phases] ...`. Это ключ: каждое правило имеет строку в [реестре VALIDATOR_RULES.md](https://github.com/dex-it/ai-kit/blob/main/docs/VALIDATOR_RULES.md), где указана норма («почему так»). Проверки строгие, мягкого режима нет; предупреждения (`WARNING`) PR не блокируют, ошибки (`ERROR`) блокируют. Общая картина проверок: [Цепочка проверок](/architecture/validation-chain/).

## Как читать вывод

Запустите валидатор на одном файле, а не на всём каталоге:

```bash
node tools/validate-skill.js   <путь к SKILL.md>
node tools/validate-agent.js   <путь к агенту>
node tools/validate-command.js <путь к команде>
npm run validate:bundles
```

Пример: skill, написанный как документация, с запрещённым полем и без активаторов.

```text
ERROR [frontmatter-forbidden] Forbidden frontmatter field: keywords - not supported by Claude Code for skills
ERROR [description-short] Description shorter than 50 characters - likely missing trigger keywords
ERROR [description-no-activation] Description must contain "Активируется при" (or "Triggers") followed by keywords ...
ERROR [trap-empty] Trap skill has neither a checklist item nor an H3 trap - nothing for the executor to apply
```

Каждая строка - отдельная причина, исправляются независимо. Агент-«пустышка» (описание «Помогает с кодом», без фаз) даёт восемь ошибок сразу: `no-phases`, `frontmatter-skills-missing`, `frontmatter-model-missing`, `frontmatter-description-short`, `frontmatter-description-no-triggers`, `frontmatter-no-skill-tool`, `handoff-input-missing`, `handoff-output-missing`. Не пугайтесь числа: большая часть исчезает после добавления фаз и frontmatter по образцу ([Писать агента](/authoring/agent/)).

## Skills

| Правило | Что значит | Как исправить |
|---|---|---|
| `frontmatter-forbidden` | поле вне перечня платформы (чаще `keywords`) | убрать поле, ключевые слова перенести в `description` после «Активируется при» |
| `description-short` / `description-no-activation` / `description-few-keywords` | нет якоря технологии или меньше 10 активаторов | дописать технологию и аспекты по формуле ([Как писать description](/authoring/descriptions/)) |
| `description-long` (предупреждение), `description-too-long`, `description-exceeds-claude-limit` | описание длиннее 500, 750 или 1536 знаков | срезать точки входа, оставить аспекты |
| `trap-empty` | нет ни одного пункта чек-листа и ни одной ловушки | добавить пункты-ситуации |
| `trap-missing-triad` | раздел H3 без «Плохо / Правильно / Почему» | либо вернуть пункт в чек-лист, либо дописать триаду; для process-skill - зарегистрировать его в `PROCESS_SKILLS` |
| `documentation-style-title` | заголовки вида «Как настроить», «Что такое», «Шаг N» | переписать в ситуации и ловушки; документация API - не материал skill |
| `code-fence-too-long` | блок кода длиннее 12 строк | заменить указателем на API или условие |
| `size-exceeds-recommended`, `size-exceeds-hard-limit`, `chars-exceed-hard-limit` | skill разросся | разделить подтемы, вырезать документацию, детали вынести в `references/` |
| `plugin-name-unknown`, `skill-reference-unknown` | в тексте названо несуществующее `dex-...` или `{plugin}:{skill}` | поправить опечатку в имени; указатель обязан вести в существующее место |
| `catalog-docs-link` | тело ссылается на файл из `docs/` каталога | убрать: в установленный плагин `docs/` не входит; нужную норму перенесите в сам артефакт или в skill |
| `link-escapes-plugin` | ссылка `](../соседний-плагин/...)` | назвать соседа формой `{plugin}:{skill}`; подъём внутри своего плагина разрешён |

## Агенты

| Правило | Что значит | Как исправить |
|---|---|---|
| `frontmatter-required` | нет `name`, `description` или `tools` | добавить |
| `frontmatter-forbidden` | поле `allowed-tools` | у агентов поле называется `tools` |
| `frontmatter-model-missing` | нет явного `model` | выбрать тир по характеру суждения ([Модель и effort](/practices/models-effort/)); `inherit` не годится |
| `frontmatter-effort-unsupported-model` | `effort` указан при модели без этой оси | убрать `effort` или сменить модель |
| `frontmatter-description-no-triggers` | в описании нет слова «Триггеры» | дописать симптомы по формуле |
| `frontmatter-no-skill-tool` | агент грузит skills, а `Skill` нет в `tools` | добавить `Skill` |
| `frontmatter-skills-missing` | не предзагружен контракт стыка | `skills: [dex-skill-node-contract:node-contract]` в полной форме |
| `frontmatter-skills-bare-plugin-name` | в `skills:` голое имя плагина | форма `{plugin}:{skill}`, иначе платформа пропустит запись молча |
| `frontmatter-skills-not-preloadable` | в `skills:` условный skill | условные skills грузятся в фазе через `Skill`, а не в предзагрузке |
| `no-phases`, `phase-missing-goal`, `phase-missing-exit` | нет фаз, цели или критерия завершения | оформить `## Phase N: Имя` с `**Goal:**` и `**Exit criteria:**` |
| `phase-non-observable-exit` | критерий вроде «агент понял» | заменить наблюдаемым артефактом или внешним фактом |
| `phase-procedural-body` | тело фазы - процедура (команды, код) | переписать в контракт: цель, результат, критерий |
| `phase-mandatory-tail` | после `**Mandatory:** yes` стоит пояснение | пометка голая; причину несут Goal и Exit criteria |
| `glued-attribute-block` | атрибуты фазы слиплись в один абзац | пустая строка между атрибутами |
| `handoff-input-missing`, `handoff-output-missing` | нет `**Input (handoff):**` или `**Output (handoff):**` в теле | объявить сигнатуру; образец внутри блока кода не засчитывается |
| `judge-without-write` | агент пишет метку `quality-checks`, но нет `Write`/`Edit` | добавить инструмент |
| `factcheck-cascade-incomplete` | есть фаза проверки фактов, но каскад инструментов неполон | `ToolSearch`, `WebSearch` и `WebFetch` вместе |
| `agent-file-name-mismatch`, `agent-file-nested` | файл не совпадает с `name` или лежит в подкаталоге `agents/` | переименовать, поднять файл в `agents/` |

## Команды

| Правило | Что значит | Как исправить |
|---|---|---|
| `frontmatter-required` | нет `description` | добавить одно предложение |
| `bash-script-detected` | тело - набор shell-команд | заменить целью и форматом результата |
| `procedural-body` | пронумерованная процедура | переписать в «Goal / Output / Constraints» |
| `documentation-style-title` | команда оформлена как документация | убрать «Как работает», «Туториал» |
| `size-exceeds-recommended`, `size-exceeds-hard-limit` | больше 80 строк, больше 200 строк | вырезать справочники; при 200+ - делать агента |
| `code-fence-too-long` | блок кода длиннее 5 строк | убрать или заменить описанием |

## Бандлы и каталог

| Правило | Что значит | Как исправить |
|---|---|---|
| `bundle-not-closed`, `bundle-agent-not-closed`, `bundle-command-not-closed` | компонент называет артефакт, которого нет в бандле | добавить недостающий плагин в `dependencies[]` бандла ([Плагин и бандл](/authoring/plugin-bundle/)) |
| `dependency-not-pulled` | запись в `dependencies[]` никто не называет | убрать лишнюю запись или перенести в `includes[]` |
| `dependency-also-included` | плагин стоит в обоих списках | оставить в `includes[]` |
| `include-not-in-marketplace` | компонент бандла отсутствует в `marketplace.json` | добавить запись или исправить имя |
| `version-mismatch` | версия в `plugin.json` и `marketplace.json` разная | выровнять; `npm run sync:marketplace` |
| `description-mismatch` | витрина в двух манифестах разная | править в `plugin.json`, затем `npm run sync:marketplace` |
| `description-not-russian` | витрина без кириллицы | написать по-русски по телу плагина |
| `catalog-category-mismatch` | `category` не соответствует содержимому | вывести из состава: `agents/` - specialist, `skills/` - skill и так далее |
| `readme-plugin-unnamed`, `readme-row-ghost` | плагин не назван в README или строка ведёт в никуда | поправить таблицу витрины в нужной форме имени |
| `readme-version-drift` | версия подвала README не равна версии каталога | выровнять вручную |

## Терминология

| Правило | Что значит | Как исправить |
|---|---|---|
| `ousted-name` | использовано имя со статусом «к вытеснению» | заменить основным именем из словаря |
| `home-unresolved`, `home-term-absent` | у строки словаря дом не существует или не содержит термин | поправить адрес дома или добавить термин в нормативный документ |

Новый термин заводится строкой в [словаре](https://github.com/dex-it/ai-kit/blob/main/docs/domain/domain-model.md) тем же изменением, что вводит имя, затем `npm run sync:terminology` обновляет перечень.

## Если вы автор нового правила валидатора

Новое или переименованное правило требует: строку в `docs/VALIDATOR_RULES.md`, директорию с фикстурой `tools/__fixtures__/<валидатор>/<правило>/`, а при новом валидаторе - строку в `package.json` и шаг в CI. Иначе падают `rule-not-documented` и `rule-registry-stale` мета-проверки. Подробности - в [Тестировать изменения](/authoring/testing/).

## Если сообщение непонятно

1. Найдите имя правила в [реестре](https://github.com/dex-it/ai-kit/blob/main/docs/VALIDATOR_RULES.md): колонка «Норма» ведёт к причине.
2. Посмотрите фикстуру правила в `tools/__fixtures__/<валидатор>/<правило>/`: там минимальный пример нарушения.
3. Не обходите правило: если оно кажется неверным, откройте обсуждение, а не отключайте проверку (мягкого режима нет).
