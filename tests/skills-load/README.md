# Загрузка skills агентом: бриф с полем `skills-loaded` и без него

**Статус: кейс заведён, прогон не выполнен.** Платных запусков на живых моделях при заведении не было; в `tests/tools/skills-load.test.sh` (`npm run test:tools`) проверена только оснастка: раскрытие записи прогонов и счёт по синтетическому потоку. Пункт задачи #128 «кейс в `tests/` показывает загрузку без подсказки в брифе» остаётся открытым до прогона.

## Предмет

Императивная загрузка skills - шаг внутри фазы, и модель молча его пропускает (#128: dotnet-coder в прямом режиме - ни одного скилла в 9 запусках из 14; проба 17.11.2026 - 0 из 3 при нейтральном брифе, 3 из 3 при брифе со строкой про `skills-loaded`). Кейс меряет две вещи на одном агенте и одной задаче:

1. **Ветка `plain`** - подробный бриф, задающий план и формат отчёта, без строки про skills. Агент после правки #128 несёт `skills-loaded` в `Output (handoff)`; вопрос - грузит ли он skills и называет ли их без подсказки в брифе.
2. **Ветка `line`** - тот же бриф плюс строка правила брифа `dex-skill-subagent-dispatch:subagent-dispatch`.

## Кейс SL1

- Агент: `dex-dotnet-coder:dotnet-coder`, модель `sonnet`, `claude -p --agent`.
- Вход: `inputs/task.md` (standalone-функция `Pricing.ApplyDiscount`, проекта нет, build и test запрещены) плюс бриф ветки: `inputs/brief-plain.md` или `inputs/brief-with-line.md`.
- Ожидаемые императивные загрузки: `dex-skill-dotnet-testing-patterns:dotnet-testing-patterns` (тесты пишутся в этой же правке), `dex-skill-test-coverage:test-coverage` (замер покрытия написанных тестов). `project-baseline` и `codebase-conventions` у dotnet-coder - pre-load (`skills:`), в счёт вызовов не входят.

## Инварианты (по каждому прогону, «да / нет»)

1. Вызван `Skill` хотя бы раз; оба ожидаемых skills среди вызванных.
2. В итоговом тексте есть поле `skills-loaded`; загруженные названы полным `{plugin}:{skill}`, пропущенные - с причиной.
3. Причина «skill не поднялся» (`coverage: unverifiable`) стоит только при вызове `Skill`, названном в `skills-loaded`.
4. Поля handoff агента (`coverage`, `run-status`) на месте: формат отчёта брифа их не вытеснил.

Недетерминированность лечится повтором: кейс, прошедший один раз из трёх, не пройден (метод - [tests/README.md](../README.md#метод-живой-прогон)).

## Прогон (не выполнялся)

```
SKILLS_LOAD_PLUGINS="<каталоги плагинов dex-dotnet-coder, dex-skill-*>" ./run.sh <каталог> plain:1..3 line:1..3
node score.mjs <каталог>
```

`SKILLS_LOAD_DRY_RUN=1` печатает раскрытые прогоны, не требуя `claude`. Среда оператора в прогон не идёт (`--setting-sources project --strict-mcp-config`, `OPERATOR_ENV=1` снимает). Нужен `timeout` (GNU coreutils; на macOS `gtimeout`).

## Что не покрыто

- **REPL-сессия.** Задача #128 просит прогнать часть кейсов в REPL Claude Code; `CLAUDE_CODE_REPL=1` из `claude -p` не включается, а `tools.Skill` в REPL в потоке виден как вызов REPL, не как `Skill`. Счётчик `score.mjs` REPL-прогоны не покрывает; ручной прогон в REPL-сессии не делался.
- Узлы трека `dex-auto`: свидетельство загрузки у них - первая строка `decisions`, схему выдачи держит скрипт трека; кейсы `tests/auto-nodes/` не менялись.

## Записи прогонов

Нет. Первая запись - строка здесь и строка реестра в [tests/README.md](../README.md) после прогона.
