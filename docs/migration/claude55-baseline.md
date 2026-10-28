# Базовая линия постоянного слоя для миграции на Claude 5.5

Рабочий документ эпика [#7](https://github.com/dex-it/ai-kit/issues/7), не норма каталога. Удалить в [#41](https://github.com/dex-it/ai-kit/issues/41) вместе с `claude5-context-inventory.md`; выводы, которые должны пережить миграцию, к тому моменту переезжают в нормативные доки.

**Замер:** `develop` @ `0f146b6f`, 26.10.2026, `npm run measure:context` (`tools/measure-context.js`). Мера - байты, строки и знаки; токены не оцениваются (локального токенайзера нет). Числа ниже воспроизводятся командой, а не пересказываются: любая сабзадача берёт замер до и после и сравнивает `node tools/measure-context.js --diff before.json after.json`.

**Что считается постоянным слоем.** Корневые `CLAUDE.md` и `AGENTS.md`, правила без `paths`, `description` всех skills, агентов и команд, skills из `skills:` во frontmatter агента (инъекция полного `SKILL.md` при каждом запуске), системные промты лаунчера. Правило нулевого прироста - в эпике, раздел 1. Режимы `paths` и `references/` в сумму `always` и `listing` не входят.

**Чего скрипт не меряет.** Токены (для живой установки - `/context` и `/doctor`); качество (его меряет стенд эвалов [#9](https://github.com/dex-it/ai-kit/issues/9)); плотность стиля - только приближённо: счётчики запретов, капса и просьб перепроверки - регулярные выражения, а не оценка текста.

## Замер

## Постоянный слой

| Что | Режим | Файлов | Строк | Знаков | Байт |
|---|---:|---:|---:|---:|---:|
| `CLAUDE.md` | always | 1 | 147 | 30 144 | 47 526 |
| `.claude/rules/docs-changes.md` | paths | 1 | 23 | 5 651 | 9 209 |
| `.claude/rules/plugin-changes.md` | paths | 1 | 71 | 16 602 | 25 382 |
| `.claude/rules/terminology.md` | always | 1 | 16 | 2 520 | 4 144 |
| `run-claude/system-prompt-plugin.md` | launcher | 1 | 17 | 1 584 | 2 758 |
| `run-claude/system-prompt-sysadmin.md` | launcher | 1 | 11 | 946 | 1 671 |
| `run-claude/system-prompt.md` | launcher | 1 | 35 | 1 855 | 3 151 |
| `description: skills` | listing | 102 | 0 | 36 336 | 57 742 |
| `description: агенты` | listing | 75 | 0 | 32 097 | 46 498 |
| `description: команды` | listing | 110 | 0 | 9 117 | 14 346 |

Режимы: `always` - каждая сессия и субагент; `listing` - только `description` в листинге; `paths` - по сопоставлению пути; `launcher` - системные промты `run-claude`. Сумма `always` и `listing`: 163 строк, 110 214 знаков, 170 256 байт.

## Предзагрузка skills (`skills:` во frontmatter агента)

| Skill | Агентов | SKILL.md, байт | references, байт | За прогон всех агентов, байт |
|---|---:|---:|---:|---:|
| `node-contract` | 64 | 49 310 | 104 296 | 3 155 840 |
| `project-rulebook` | 1 | 37 366 | 19 070 | 37 366 |
| `business-analysis-29148` | 1 | 32 306 | 0 | 32 306 |
| `use-cases-cockburn` | 2 | 13 897 | 0 | 27 794 |
| `architecture-definition-42010` | 2 | 13 111 | 0 | 26 222 |
| `system-requirements-29148` | 1 | 21 686 | 0 | 21 686 |
| `bdd-gherkin` | 1 | 20 102 | 0 | 20 102 |
| `interface-definition-openapi` | 1 | 11 918 | 0 | 11 918 |

Итого за прогон всех предзагружающих агентов: 3 333 234 байт.

## Skills по группам

| Группа | Skills | КБ | Ср. КБ | references, КБ | description ср./макс. | Запретов/КБ | Капс | Просьб перепроверки | Длинных предл., % | Контрольные наборы | Крупнейшие, КБ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| S1 Контекст проекта и нормы репозитория | 14 | 138 | 9,8 | 38 | 428/497 | 0,09 | 0 | 0 | 24 (было 33) | 6/14 | project-rulebook 36,5, project-docs-map 24,9, docs-layout 15,8 |
| S2 Мета-нормы: письмо, ревью артефактов, делегирование | 8 | 162 | 20,3 | 107 | 438/498 | 0,12 | 0 | 4 | 21 (было 25) | 2/8 | node-contract 48,2, optimize-for-llm 44,6, artifact-review 37,7 |
| S3 Требования, продукт и планирование | 18 | 164 | 9,1 | 0 | 370/489 | 0,07 | 1 | 0 | 17 (было 29) | 10/18 | business-analysis-29148 31,5, idea-forming 29,8, system-requirements-29148 21,2 |
| S4 Архитектура, API и проектирование | 12 | 38 | 3,2 | 0 | 373/483 | 0 | 0 | 0 | 7 (было 21) | 10/12 | architecture-definition-42010 12,8, interface-definition-openapi 11,6, api-spec-quality 2,1 |
| S5 Ревью, качество и тесты | 9 | 41 | 4,6 | 23 | 401/496 | 0,02 | 0 | 0 | 12 (было 18) | 7/9 | defect-classification 14,3, test-coverage 6,6, merge-conflict-resolution 5,3 |
| S6 Отладка и диагностика | 11 | 51 | 4,6 | 0 | 342/422 | 0,02 | 0 | 0 | 1 (было 63) | 11/11 | managed-debug 7,8, syscall-tracing 7,2, shared-stand-safety 7,1 |
| S7 .NET | 9 | 9 | 1 | 0 | 303/394 | 0 | 0 | 0 | 2 (было 28) | 9/9 | dotnet-ef-core 1,5, dotnet-resilience 1,4, dotnet-api-development 1,4 |
| S8 TypeScript, веб и автоматизация тестов | 5 | 6 | 1,2 | 0 | 291/356 | 0 | 0 | 0 | 0 (было 33) | 5/5 | ts-vitest-jest 2,2, playwright 1,6, api-testing 0,9 |
| S9 Python и ML | 6 | 5 | 0,8 | 0 | 238/334 | 0 | 0 | 0 | 5 (было 17) | 6/6 | python-nlp-transformers 1,5, python-project-hygiene 1, python-pytorch 0,6 |
| S10 Инфраструктура и CI/CD | 10 | 9 | 0,9 | 0 | 272/358 | 0 | 0 | 0 | 3 (было 25) | 10/10 | kafka 1,3, mongodb 1,2, redis 1 |
| Итого | 102 | 623 | 6,1 | 0 | 356/498 | 0,07 | 1 | 4 | 16 (было 29) | - | - |

Колонка «Длинных предл., %» пересчитана 28.10.2026 ([#69](https://github.com/dex-it/ai-kit/issues/69)) на том же дереве `0f146b6f`: граница предложения теперь строка Markdown (заголовок без точки, пункт списка и строка с меткой `Плохо:`, `Правильно:`, `Почему:` не склеиваются; жёсткий перенос внутри фразы склеивается). В скобках - значение при замере (прежний счёт воспроизводится тем же скриптом до правки). Остальные колонки не менялись.

## Агенты по группам

| Группа | Агентов | КБ | Ср. КБ | description ср./макс. | Модели | effort | Предзагрузка node-contract | Крупнейшие, КБ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A1 Ревью | 8 | 225 | 28,1 | 473/495 | opus 7, sonnet 1 | - | 8 | design-reviewer 39,2, requirements-reviewer 37,4, mr-reviewer 36,4 |
| A2 Требования, продукт, аналитика | 12 | 180 | 15 | 475/500 | opus 2, sonnet 10 | - | 12 | business-requirements-analyst 31,6, user-story-analyst 21,9, domain-analyst 20,9 |
| A3 Архитектура, API, документы | 6 | 102 | 16,9 | 478/496 | opus 2, sonnet 4 | medium 1 | 6 | architect 23,1, architect-dotnet 22,8, adr-writer 21,5 |
| A4 Реализация и тесты | 7 | 107 | 15,3 | 450/497 | sonnet 7 | - | 7 | dotnet-coder 20,4, ts-test-writer 18,1, dotnet-test-writer 17,9 |
| A5 Баги и диагностика | 12 | 180 | 15 | 445/491 | (нет) 1, opus 6, sonnet 5 | - | 11 | debugger 27,3, incident-investigator 24,8, bug-fixer 23,2 |
| A6 DevOps и инфраструктура | 15 | 173 | 11,5 | 433/497 | sonnet 15 | - | 15 | docker-specialist 16, postgresql-specialist 12,4, grafana-specialist 12,3 |
| A7 ML | 3 | 27 | 9,1 | 482/489 | sonnet 3 | - | 3 | deployment-assistant 9,2, model-trainer 9,1, ml-experimenter 8,9 |
| A8 Автономная работа и добыча правил | 12 | 120 | 10 | 276/497 | (нет) 10, opus 2 | - | 2 | rulebook-orchestrator 24,1, skeptic 16,4, reviewer 15,4 |
| Итого | 75 | 1114 | 14,8 | 428/500 | - | - | - | - |

## Команды

110 команд, 345 283 байт (337 КБ, среднее 3,1 КБ); `description` в среднем 83 знаков, максимум 334. Длинное или среднее тире: 89 вхождений в 15 файлах. Крупнейшие, КБ: mr-analyze 39,7, auto 19,4, mr-apply 16,5.

## Поправки к снимку в эпике

Снимок в разделе 6 эпика собран одноразовым скриптом вне репозитория. Воспроизведение командой выявило ошибки в нём; эпик и затронутые сабзадачи исправлены.

| Что | В снимке | Верно |
|---|---|---|
| `description` агентов, среднее/максимум по группам (раздел 6.3) | 566-633/634-705 (A8: 423/698) | 276-482/489-500 (таблица выше) |
| `description` команд, среднее | 185 знаков | 83 знака |
| `description` skills: сумма / максимум | 36 414 / 508 знаков | 36 336 / 498 знаков |
| Крупнейшие команды | `/mr-analyze` 26 КБ, `/auto` 13 КБ, `/mr-apply` 11,5 КБ | 39,7 / 19,4 / 16,5 КБ в байтах; в снимке стояли тысячи знаков, названные КБ |

Причина: регулярное выражение поля `description` в одноразовом скрипте с флагом «точка совпадает с переводом строки» захватывало и следующие поля frontmatter (`tools`, `model`, `skills`). Скрипт репозитория читает frontmatter разбором YAML.

Остальные числа раздела 6 воспроизводятся без расхождений: размеры `CLAUDE.md`, правил и системных промтов, группы skills и агентов по объёму, предзагрузка `node-contract` (64 из 75 агентов), число команд, тире в командах, контрольные наборы (76), модели и `effort`.

## Как сравнивать

```bash
npm run measure:context -- --json > before.json
# правка
npm run measure:context -- --json > after.json
node tools/measure-context.js --diff before.json after.json
```

Разность по файлам совпадает с `git diff --numstat`: байты и чистый прирост строк (добавлено минус удалено) по тем же файлам. Проверено на тестовой правке: `CLAUDE.md` +2 строки, `debugger.md` -3 строки.
