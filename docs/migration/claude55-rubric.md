# Рубрика правок для миграции на Claude 5.5

Рабочий документ эпика [#7](https://github.com/dex-it/ai-kit/issues/7), не норма каталога. Удалить в [#41](https://github.com/dex-it/ai-kit/issues/41); выводы, которые должны пережить миграцию, переезжают в нормативные доки. Дополняет [claude5-context-rubric.md](claude5-context-rubric.md): его категории и записи не переписываются, ниже только то, что меняется для 5.5. Базовая линия объёма - [claude55-baseline.md](claude55-baseline.md).

Принципы `P*`, источники `R*`, `G*`, `K*` и эксперименты `E*` - в эпике (разделы 5, 8 и 11). Сверка с документацией Anthropic - 26.10.2026.

**Правило записи (без изменений).** Каждая снятая, добавленная или переписанная строка получает категорию и причину в журнале правки. Новое: **каждая добавляемая строка называет снимаемую**, а запись несёт дельту байт и строк по файлу. Исключение - решение владельца в комментарии к задаче с замером.

## Охват по моделям

Правка, выведенная с модель-специфичной страницы, законна только для артефактов на этой модели. Состав тиров берётся прогоном по полю `model:` в момент переноса. Артефакт без `model:` наследует модель сессии, поэтому правка для него идёт по общей части руководства.

| Правило | `opus` | `sonnet` / `haiku` на `low`/`medium` | Опора |
|---|---|---|---|
| Инструкция самопроверки в теле агента | Снимать | Не снимать из общего слоя: один абзац «доведи до конца, проверь по-настоящему» в общем слое, в каждый агент не копировать | G2, G3, G4 |
| Завершение требует внешнего факта (вывод команды, список прочитанного) | Да | Да | R84, R69, R72 |
| Явная строка о границе объёма и праве на бездействие | Сохранять | Сохранять | R97, R98, G3 |
| `effort: medium` явно | Снимать (дефолт) | Снимать (дефолт) | G9, K11 |
| `effort` у `haiku` | Допустим для Haiku 5.5 | Допустим для Haiku 5.5 | G4, G9 |

Оговорка по провайдеру: алиасы `sonnet`, `opus`, `haiku` на Anthropic API разрешаются в 5.5, на других провайдерах в 4.x ([K11](https://github.com/dex-it/ai-kit/issues/7#k11)). Правило, зависящее от версии, помечается этим условием. Строка про `effort` у `haiku` в таблице исправляет расхождение 2 из эпика (раздел 2.3) и сверяется в [#14](https://github.com/dex-it/ai-kit/issues/14).

## Категории и решения для 5.5

Столбец «Снимаемая строка» обязателен: без названной строки категория «добавить» не применяется.

| Категория | Признак | Решение | Принцип |
|---|---|---|---|
| Обзор вместо ловушки | Абзац пересказывает структуру или то, что выводится из кода | Снимать после абляции E1; в постоянный слой - только невыводимое: команды, нетривиальные конвенции, грабли | P2 |
| Дубль другого дома | Правило живёт в skill, фреймворке или платформе | Заменять ссылкой; текст не пересказывать | P3 |
| Правило-совет без принуждения | «Всегда делай X» без проверки | Либо hook или валидатор, либо снять; общий совет не оставлять | P4 |
| Перегруз обязательствами | В теле исполнителя больше обязательств, чем держит тир | Делить по фазам или переносить вниз; критичное в начале и в конце | P5 |
| Граница объёма | Агент меняет файлы или предлагает правки | Сохранять строку о границе и о праве ничего не менять; снятие только по E10 | P6 |
| Завершение без доказательства | «Готово» без вывода команды или списка прочитанного | Добавлять требование внешнего факта взамен названной общей фразы | P7 |
| Просьба «только важное» в ревью | Ревьюер фильтрует находки сам | Заменять на «полный список + независимая сверка» | P8 |
| Безусловный спавн субагентов | Агент вызывает субагента на каждом запуске | Делать условным с названным признаком | P9 |
| Двойник в `description` | Два артефакта с неразличимым описанием | Различать описания; примеры сокращать до одного верного | P10 |
| Запрет без принуждения | Отрицательная формулировка без hook | Переформулировать положительно либо перенести в принуждение (E12); отрицание в нормативной границе (безопасность, необратимое) не трогать | P4, P6 |
| Правило без причины | Нет причины и условия снятия | Записывать причину и условие снятия либо снимать | P14 |
| Сжатие | Переписывание ради краткости | Только вручную, с проверкой удержания ограничений (E5); пороги, исключения и границы не трогать | P12 |

**Сохранять без обсуждения (без изменений относительно прошлой рубрики):** мнение команды и доменные грабли, безопасность и необратимое действие.

## Журнал правки

Каждая сабзадача ведёт таблицу в своём PR:

| Файл | Строка (начало) | Категория | Решение | Основание | Δ байт | Δ строк |
|---|---|---|---|---|---:|---:|

Сумма столбцов Δ не должна быть положительной по постоянному слою; по слою «по вызову» положительная сумма требует решения владельца.

## Журнал правки: S1 (#16), skills контекста проекта и норм репозитория

Правка только ручная и только по повторам внутри плагина; пороги, исключения и границы не тронуты, `description` не менялись. Проба удержания - `tests/trap-skills/_s1-retention/`: 13 вопросов с регулярными грейдерами, плечи old (`develop`) / new / none (без skill), `claude -p`, 29.10.2026 (клиент 2.1.311), Haiku 5.5 по 5 прогонов и Sonnet 5.5 по 3, medium. Старое против нового: Haiku 57/65 и 60/65, Sonnet 38/39 и 38/39. Без skill: Haiku 14/65, Sonnet 12/39. Грейдеры расширялись по разбору ответов после первого прогона (слова без границ `\b`, порядок слов), одинаково для всех плеч, затем все серии пересчитаны. Полосы шума у пробы нет: критерий "новое не хуже старого по сумме, расхождение в один прогон на вопрос - шум".

| Файл | Строка (начало) | Категория | Решение | Основание | Δ байт | Δ строк |
|---|---|---|---|---|---:|---:|
| project-rulebook `SKILL.md` | "Норматив нужен потому" | Обзор вместо ловушки | Снято: повторяет первый абзац раздела | P2; PR1, PR2 | -403 | -2 |
| completeness-mapping `SKILL.md` | "Почему лестница"; "Authoritative != эвристический call-graph"; гейт, п.1 | Обзор; Дубль другого дома | Абзац причин снят (ответ даёт столбец "Слеп к"); тезис про эвристический анализатор сказан один раз в разделе, в гейте остался ссылкой на статус | P2, P3; CM1, CM2 | -779 | -7 |
| docs-layout `SKILL.md` | "Адресуют корпус ключи"; "не подменяет карту" | Дубль другого дома | Ключ - адрес, дерево - дефолт: дом - раздел 1 и карта документации; здесь оставлено действие шага | P3; DL1, DL2 | -449 | 0 |
| docs-layout `references/tree.md` | "BRD продукта, SAD"; "ADR по папкам"; "Контракты"; "Глубина"; "Границы фич"; "Минимум обязательного" | Дубль другого дома | Три правила размещения и глубина живут в `SKILL.md`, раздел 2; в дереве - сведены в одну строку и указатель | P3; DL2 | -1 002 | -7 |
| docs-layout `references/identifiers.md` | "Принадлежность фиче"; "Параллельная работа"; "Это дополнительный довод" | Дубль другого дома | Блок номеров - `SKILL.md`, раздел 4; довод против префиксных ID сказан выше в том же файле | P3; DL1 | -716 | -1 |
| project-docs-map `SKILL.md` | "Отвечает на вопрос"; "Файл на ключ" | Дубль другого дома; Сжатие | Фраза про дерево как дефолт - дом в docs-layout; причина файла на ключ сокращена до двух предложений | P3, P12; DM1-DM4 | -519 | 0 |
| stack-registry `SKILL.md` | перечень агентов; "Префикс и description"; "Чек-лист загрузки" | Дубль; Обзор | Список агентов дрейфует, чек-лист пересказывает разделы выше; оси сведены в один абзац с теми же пороговыми фактами | P2, P3; SR1, SR2 | -1 261 | -14 |

Не применено: перенос `project-rulebook` в ядро и `references/` (нужна серия RM1, RQ1, RQ2, RQ0 и E3 на оркестраторе), снятие строки "Опоры названы прямо" (ссылки на SARIF и Allamanis - источник утверждений, не обзор), правка `project-baseline` (слияние двух абзацев про отговорки байтов не давало и добавляло строку - откат), удаление предложения про совпадение `product`, `domain` и `root` из `project-docs-map` (проба DM3 показала, что без него и без `docs-layout` модель называет это ошибкой; возвращено).

Не менялись, причина: `project-baseline` (команды и пути, P4; слияние абзацев байтов не давало), `issue-tracking` и `legacy-reconstruction` (нет повторов, текст - решётка событий и три шага с границами), `codebase-conventions`, `ci-gates`, `artifact-naming`, `unit-identity`, `rule-mining`, `rulebook-quality` (уже сжаты до названий по свидетельству наборов; снятие ждёт серии с/без skill на 5.5).

## Журнал правки: S3 (#17), требования, продукт и планирование

Правка только ручная и только по повторам внутри skill и по обзорному; пороги, исключения и границы, ссылки на стандарты (ISO 29148, Cockburn, 29119, Gherkin) не тронуты, `description` не менялись. Предзагружаемые тяжеловесы в `references/` не переносились. Проба удержания - `tests/trap-skills/_s3-retention/`: 18 вопросов с регулярными грейдерами, плечи old (`develop`) / new / none (без skill), `claude -p` 2.1.311, medium, 29.10.2026. Старое против нового: Haiku 5.5 (5 прогонов) 82/90 и 83/90, Sonnet 5.5 (3 прогона) 54/54 и 54/54. Без skill: Haiku 35/90, Sonnet 16/54. Грейдеры исправлены дважды после первого разбора ответов (формы слов; в BA1 снята третья проверка о канале), каждый раз одинаково для всех плеч и для обеих моделей, серии пересчитаны по сохранённым ответам; до пересчёта Haiku давал old 73/90, new 69/90. Полосы шума у пробы нет; на Sonnet потолок (54/54), малые регрессии он не виден.

| Файл | Строка (начало) | Категория | Решение | Основание | Δ байт | Δ строк |
|---|---|---|---|---|---:|---:|
| business-analysis-29148 `SKILL.md` | "Есть ли у яруса канал"; "Куда ложится найденное"; "Составитель оракулы прогоняет" | Дубль другого дома; Сжатие | Правило канала сведено к ссылке на D.11 `node-contract`; абзац о размещении исхода сокращён без смены правила; повтор `self-check` (он в разделе 6) слит с абзацем о проверенности | P3, P12; BA1-BA3 | -592 | -4 |
| idea-forming `SKILL.md` | "Каталог методик вместо одной"; "Метрика придумана под идею"; "Риски перечислены без приоритета"; "Чего выход не содержит"; `superpowers:brainstorming`; "Групповые форматы" | Дубль (повтор правил раздела 2, 4, 6 и границ соседей); Сжатие | Три ловушки повторяли правила тела слово в слово; перечень "чего не содержит" - пункты границ соседей; цитата и довод про `superpowers`, группы - сокращены, вывод и порог сохранены | P2, P12; ID1-ID6 | -2 728 | -24 |
| system-requirements-29148 `SKILL.md` | "Режим приходит полем"; "Объём раздела" | Дубль другого дома | Две ссылки на `business-analysis-29148` слиты в одну; правило объёма слито с абзацем о статусе пустого раздела | P3; SR1, SR2 | -218 | -4 |
| bdd-gherkin `SKILL.md` | "Отдельного норматива у этой работы"; "Сверка консервативна"; "Пробел покрытия здесь не считается" | Сжатие; Дубль | Пробел назван короче; довод сверки по ревизии сохранён; предложение о покрытии снято (дом - раздел 1, покрытие считается по AC) | P12, P3; BD1-BD4 | -526 | 0 |
| use-cases-cockburn `SKILL.md` | "Исполняемые примеры отсюда" | Дубль другого дома | Правило про `.feature` - дом `bdd-gherkin`; здесь сказано одной фразой | P3; UC1 | -159 | 0 |
| opportunity-canvas `SKILL.md` | "Граница с этапом замыкания"; "Цикл draft" | Дубль другого дома | Граница с `idea-forming` сказана короче; довод про отсутствие судьи стоит во введении | P3; OC1, OC2 | -432 | 0 |

Версии (patch): `dex-skill-business-analysis-29148` 4.6.1, `dex-skill-idea-forming` 1.3.5, `dex-skill-system-requirements-29148` 1.1.1, `dex-skill-bdd-gherkin` 1.0.2, `dex-skill-use-cases-cockburn` 1.0.1, `dex-skill-opportunity-canvas` 1.0.1; `marketplace.json` синхронизирован.

Не менялись, причина: `functional-requirements`, `nfr`, `requirement-quality`, `requirement-set-quality`, `use-case-quality`, `user-stories`, `product-discovery`, `prioritization`, `epic-planning`, `plan-quality` (наборы trap-skills; уже сжаты до пунктов-названий по свидетельству, снятие ждёт серии с/без skill на 5.5); `implementation-plan` (форма автора плана, принята прогоном 4 редакций, повторов нет); `verification-planning-29119` (нет повторов внутри skill; статус опоры и состав - решение каталога, сокращать нечем).

Не применено, ждёт серии: перенос блоков предзагружаемых `business-analysis-29148`, `system-requirements-29148`, `bdd-gherkin`, `use-cases-cockburn` в `references/` по требованию (R19: по требованию сохраняется около половины выигрыша; у skill нет набора trap-skills, нужна своя проба, а доступность `references/` из инъекции через `skills:` во frontmatter агента не проверена); снятие "Реестр методик" и ссылок на Klein, Kahneman, Torres и др. в `idea-forming` (источники утверждений); сжатие таблиц признаков незаполненности разделов (R44, R48: условия и границы теряются).

Различимость `description` (route.mjs, 18 skills группы, 20 реплик): Sonnet 60/60 (3 прогона), Haiku 86/100 (5 прогонов). Ошибки Haiku: "Можно ли отдавать комплект требований в разработку" -> `business-analysis-29148` (4 из 5), "Какой уровень цели у сценария и как записать шаги основного хода" -> `business-analysis-29148` (4 из 5), "Судья на гейте проверяет сценарий использования" -> `requirement-quality` (5 из 5; его `description` называет UC в перечне единиц). Описания не менялись: правка поля срабатывания без серии E7 на 30 и 100 skills не оправдана, решение владельца.

Расход платных вызовов: 4,24 USD из 10 (проба удержания: Haiku 0,30, Sonnet 2,85; различимость: Haiku 0,07, Sonnet 1,01).

## Журнал правки: S6 (#20), отладка и диагностика

Правка только ручная и только сверка фактов об инструментах (R14, R19) по `--help`, документации и пробе в образе `diag46-lab:1` (binutils 2.40, bpftrace 0.17, strace 6.1, dotnet-dump 10.0.750501, aarch64); единицы не снимались, `description` и пороги не менялись, сумма группы упала на 97 байт при 0 строк. Категории рубрики для исправления неверного факта нет: записи ниже идут как «Сверка факта» (неверная команда или утверждение заменены проверенными, добавленное не длиннее снятого по группе). Проверка метрики «длинных предложений»: 63% по `measure:context` - артефакт счёта, а не длина фраз. Строки `Плохо:`, `Правильно:`, `Почему:` и заголовки без точки склеиваются в одно "предложение" (`shared-stand-safety`: 1 предложение на 559 слов); с границей по строке в группе 2 длинных из 434 (0,5%): `managed-debug` (строка с именами Meter, 31 слово), `native-debug` (35 слов, строка с командами). Упрощать нечего; скрипт `measure-context.js` не менялся.

Прогон: набор `i` (7 запусков + 2 добавочных `d1`), `j` без скиллов, `k` на старых текстах, `claude-sonnet-5-5` medium, CLI 2.1.311, $2.278 (потолок $6); протокол - `tests/trap-skills/managed-debug/README.md`, раздел «Заход 5». Полосы шума нет.

| Файл | Строка (начало) | Категория | Решение | Основание | Δ байт | Δ строк |
|---|---|---|---|---|---:|---:|
| managed-debug `SKILL.md` | "dumpasync показал три pending" | Сверка факта | `!dumpasync -completed` -> `dumpasync --completed`, без `!` у `syncblk` и `clrthreads`; метка версии. В dotnet-dump 10.0.750501 `-completed` не принимается ("Unrecognized command or argument 'ompleted'", опция `-c`/`--completed`), `!cmd` - "Unrecognized SOS command" | R14, R19; проба в образе | +23 | 0 |
| managed-debug `SKILL.md` | "gcdump блокирует процесс" | Сверка факта | `dotnet-dump --type Full` -> `dotnet-dump collect --type Full` (подкоманды `collect` нет в прежней записи) | `dotnet-dump collect --help` | +8 | 0 |
| syscall-tracing `SKILL.md` | "Privileges на проде" | Сверка факта | снят `--unprivileged`: нет ни в `bpftrace --help` 0.17, ни в man текущего master | `bpftrace --help`; bpftrace man (master) | -45 | 0 |
| syscall-tracing `SKILL.md` | "JSON-output для агента" | Сверка факта | "стабилен с 0.16+" заменено на "NDJSON, правили до 0.27, сверь версию" (CHANGELOG: правки JSON в 0.20, 0.22, 0.24, 0.27.1) | CHANGELOG bpftrace | +6 | 0 |
| syscall-tracing `SKILL.md` | "Forgot detach" | Сверка факта | "корректно detach'ит при strace 5.0+, старые нет" заменено на формулировку man strace; версионного утверждения в man нет | man strace | -78 | 0 |
| syscall-tracing `SKILL.md` | "ltrace вместо современных" | Сверка факта | "последний релиз 2019" неверно: теги 0.8.0 и 0.8.1 - 09.2025; остальное помечено "не сверена" | gitlab.com/cespedes/ltrace, теги | +32 | 0 |
| perf-profiling `SKILL.md` | "perf_event_paranoid блокирует" | Сверка факта | "Уровень 4 (Debian)" -> "Уровни 3-4 - патчи дистрибутивов (не сверено)": upstream-дока знает уровни до 2 | kernel.org sysctl/kernel | -12 | 0 |
| perf-profiling `SKILL.md` | "Spinning loop виден" | Сверка факта | `offcputime` - инструмент bcc, не bpftrace (в `tools/` bpftrace его нет; в образе есть `offcputime-bpfcc`); опечатка "aync" | образ; GitHub bpftrace `tools/` | +2 | 0 |
| core-dumps `SKILL.md` | "coredump_filter режет" | Сверка факта | "дефолт исключает shared mmap, критично для .NET/Java" заменено на "0x33 не включает file-backed mapping": анонимные mapping (куча) в дефолте есть | man core(5) | -55 | 0 |
| core-dumps `SKILL.md` | "gcore блокирует процесс" | Сверка факта | "dotnet-dump менее блокирующе" не подтверждено документацией -> "пауза не сверена" | Microsoft Learn, dotnet-dump | -18 | 0 |
| core-dumps `SKILL.md` | "core_pattern named-pipe host-only" | Сверка факта | "контейнерное изменение игнорируется" заменено: обработчик запускается в namespaces хоста, путь ищется в хостовом mount-namespace | man core(5) | -7 | 0 |
| binary-inspection `SKILL.md` | "objdump для cross-arch" | Сверка факта | имя `elf64-aarch64-little` отвергается ("invalid bfd target"), верное - `elf64-littleaarch64`; `--target` не выбирает ISA (multiarch objdump разобрал x86-64 ELF и без него) -> ловушка переписана: cross-binutils или multiarch, `objdump -i` | проба binutils 2.40 в образе | +47 | 0 |

### Не применено, ждёт серии (платной) или решения

- Снятие общеизвестных единиц `syscall-tracing` (bcc против perf, SystemTap, ltrace, alpine, готовые bcc-инструменты), `perf-profiling` (pipeline FlameGraph, differential), `native-debug` (MI2, `bt full`): кейсов с клетками на них нет (`unverifiable`, README наборов). Условие: новые клетки в `_projects/diag/score.py` до прогона, затем с/без на `claude-sonnet-5-5` и `claude-haiku-5-5` по 3 прогона; оценка по `tests/eval55/priors.json` для repo-ячейки: sonnet около $0.15, haiku около $0.01 за запуск, на 6 клеток x 2 плеча x 3 прогона около $5.5 (sonnet) и $0.4 (haiku).
- `shared-stand-safety` (пункт 4 задачи): выражение границ белым списком глаголов и hook. Текст не менялся, итог K10 (H1 3/4 на 1.0.0 против 0/4) не откатывается. Для переноса в принуждение нужен hook на уровне `dex-kubectl-cli` и серия K6, K10 по 4 прогона на плечо (около $2.4 sonnet); решение о месте hook - владельцу.
- Возврат единицы «Mini-дамп» или переформулировка строки про `gcdump`/`--type Full` в `managed-debug`: см. результаты захода 5, MD-8 FAIL 2 из 4 с 2.1.311 при pass во всех применимых прогонах 2.1.303.
- Дубли между скиллами (debuginfod: `native-debug`, `binary-inspection`; frame pointers: `perf-profiling`, `native-debug`; `dotnet-symbol`: `managed-debug`, `core-dumps`): каждая копия стоит в своём контексте, кейса на пересечение нет; сведение в один дом - после серии.
- `root-cause-analysis`, `bug-reproduction`, `change-correlation`, `stand-verification`: уже process-skill и названия (1,3, 0,8, 1,6, 1,3 КБ), сверены с `Claude5.5/29` и агентами (`incident-investigator`, `bug-fixer`, `bug-finder` ссылаются, не пересказывают); дубль нормы красный-зелёный и якоря времени живёт в промте 29, не в каталоге. Не менялись.

### Сверка фактов: что сверено и что нет

Сверено (источник, дата 28.10.2026): `dotnet-trace collect --providers Provider:Flags:Level` и `--format NetTrace|Speedscope|Chromium` (`--help` 10.0.750501); `--showDeltas` у `dotnet-counters monitor` (там же); `dotnet-dump collect --type` и Full по умолчанию (`--help`, Microsoft Learn); `dotnet-symbol --recurse-subdirectories`, `--symbols` (`--help`); `dumpasync --completed`/`-c`, `clrthreads -live`, `syncblk`, `setsymbolserver -ms`, без `!` (проба dotnet-dump analyze); gcdump инициирует gen2 GC и может надолго приостановить рантайм (Microsoft Learn dotnet-gcdump, обновлено 21.10.2026); `netcoredbg --interpreter=mi`, `--attach` (`--help` 3.1.0); `strace -s` дефолт 32, `-y` (man strace, `strace --help` 6.1); `bpftrace -f json` (0.17, man master); CAP_BPF/CAP_PERFMON у Docker `--cap-add` (docs.docker.com, раздел capabilities); `perf record --call-graph <mode>[,size]`, `-F`, `-g` (`--help` perf 6.1); `perf_event_paranoid` уровни -1..2 (kernel.org); `coredump_filter` биты и дефолт 0x33, `core_pattern` pipe и namespaces (man core(5)); `set debuginfod enabled` у gdb 13.1; `helgrind.h` `ANNOTATE_HAPPENS_BEFORE`, `--read-var-info` (valgrind 3.19); `lldb-vscode` в lldb 14 (образ); `offcputime` в bcc; `objdump --target`, `-i`, имена BFD (binutils 2.40); `ltrace` теги 0.8.0/0.8.1.

Не сверено, оставлено как было: CAP_BPF/CAP_PERFMON с ядра 5.8; BTF и ядро 5.x+; Rizin (`-qc`, `iIj`, `ii~~import`, `pdfj`, rz-pipe) - нет в образе; LIEF (`add_section`, "активно мейнтейнится (2026)"); de4dot/dnSpyEx; `--call-graph dwarf` дефолт 8192 и LBR 16-32 кадра; `perf sched record/latency`; async-profiler против `PreserveFramePointer`; `docker run --cap-add=PERFMON --security-opt seccomp=unconfined` в целом; `coredumpctl` (`MaxUse`, `Storage=external`, `.zst`); `info shared` и `coredump_filter` как причина "no shared library symbols"; `ulimit -c`, `LimitCORE`; SELinux/AppArmor (`getenforce`, `aa-status`, `ausearch`); `bt full` и `<optimized out>`; `lldb -b -o`, `lldb-dap` как преемник `lldb-mi` (заход 2 сверил RFC 07.2019); `gdb --interpreter=mi2 -ex`; `eu-stack` с debuginfod; `binutils 2.34+` для debuginfod; совет "в проде `dotnet-dump collect` вместо `gcdump`": Microsoft Learn предупреждает, что Full/Heap дамп поднимает память процесса и может убить контейнер с лимитом; стоит проверить отдельно; `objdump` на однотипной (не multiarch) сборке выдаёт "file format not recognized" - из образа не воспроизвести. Дрейф версий инструментов - T29 (#37).

## Журнал правки: S7 (#21), .NET-skills

Текст 9 skills (`dotnet-api-development`, `-async-patterns`, `-code-quality`, `-csproj-hygiene`, `-ef-core`, `-logging`, `-resilience`, `-testing-patterns`, `-validation`) не менялся, `description` тоже, версии плагинов не поднимались. Причина: после сжатия по свидетельству (группы 2.1, 2.2, #291) каждый skill - от одного до шести пунктов-названий (0,7-1,5 КБ, всего 9 КБ), общих описаний технологии и повторов в них нет; сверка фактов с первоисточником расхождений не нашла; парная проба на Sonnet 5.5 не дала основания для снятия или переноса. Размер группы: 9 КБ до и после, 0 байт, 0 строк. Записей рубрики о снятом или добавленном нет: категории "Снять", "Сжать", "Перенос" не применялись.

### Сверка фактов (28.10.2026, Microsoft Learn и документация библиотек)

| Утверждение skill | Источник (дата правки страницы) | Вердикт |
|---|---|---|
| `ef-core`: `DateTime` без явного типа в Npgsql 6+ - `timestamptz`, пишется `Kind=Utc`; в `timestamp` пишутся Local/Unspecified | npgsql.org/doc/types/datetime: UTC -> `timestamptz`, Local/Unspecified -> `timestamp`, не-UTC в `timestamptz` бросает; чтение `timestamptz` -> Utc, `timestamp` -> Unspecified; умолчание EF-провайдера 6.0 - `timestamptz` (по сводке поиска, страница release-notes 6.0 не открывалась, страница мапинга EF вернула 404) | подтверждено; "прочитанное помечается `Utc`" в `timestamp` - действие value converter, а не поведение провайдера по умолчанию: формулировка skill об итоге конвертера, не проверена отдельной пробой, не менялась (E4 держит) |
| `ef-core`: soft-delete + required FK: FK в БД без каскада, зависимые удаляет код, разрыв связи не бросает исключение | learn.microsoft.com/ef/core/saving/cascade-delete (2025-10-30): таблица "required, dependents loaded": `ClientCascade` и `Cascade` - EF удаляет зависимых при разрыве; `Restrict`, `NoAction`, `ClientSetNull` - `InvalidOperationException`; FK для `ClientCascade` без `ON DELETE CASCADE`; Warning: "Do not configure cascade delete in the database when soft-deleting" | подтверждено; формулировка skill - это `ClientCascade`, имя в тексте не названо, не добавлялось (рост байт без свидетельства) |
| `ef-core`: `HasQueryFilter` и required-связь | learn.microsoft.com/ef/core/querying/filters (2026-06-24): required navigation + фильтр -> `INNER JOIN`, родитель пропадает; второй `HasQueryFilter` перезаписывает первый, именованные фильтры - с EF Core 10 | согласуется; "нетранслируемое условие" на странице не упомянуто, не проверено |
| `code-quality`: `AnalysisMode` в проекте при bulk-категориях в `.editorconfig` | learn.microsoft.com/dotnet/fundamentals/code-analysis/configuration-options (2026-02-13): при `AnalysisMode`/`AnalysisLevel` bulk-опции `dotnet_analyzer_diagnostic` игнорируются; категория действует только на правила, включённые по умолчанию; совет - `AnalysisMode<Category>` | подтверждено |
| `code-quality`: режим NuGet-аудита не покрывает транзитивные | learn.microsoft.com/nuget/concepts/auditing-packages (2026-07-07): `NuGetAuditMode` по умолчанию `all` при `net10.0` и выше, иначе `direct`; NU1903 - high | подтверждено; граница по TFM уже в `dex-dotnet-quality-auditor` (Phase 0, Phase 2, "Fact-check дефолта"), в skill не дублировалась: один факт - один дом |
| `resilience`: общий timeout вызова, timeout на попытку, circuit breaker, фильтр сбоев | learn.microsoft.com/dotnet/core/resilience/http-resilience (2026-03-30): порядок rate limiter, total 30 с, retry (3, exp+jitter, 2 с), breaker (10 %, 100, 30 с, 5 с), attempt 10 с; один handler без стопки; `TimeoutRejectedException`, не `TimeoutException` | согласуется |
| `resilience`: `IMemoryCache.GetOrCreate(Async)` не атомарен | learn.microsoft.com/aspnet/core/performance/caching/memory (2026-10-27): "Multiple requests might discover the cached key value is empty", "several threads repopulating" (о заполнении колбэком); атомарность `GetOrCreate` прямо не названа; зонд 10.10.2026 в `_projects/pricing/README.md` | подтверждено зондом, документация подтверждает косвенно; про `Lazy` в фабрике документация молчит, не сверено |
| `resilience`: `HybridCache` - один вызов фабрики на ключ | learn.microsoft.com/aspnet/core/performance/caching/hybrid (2026-10-13): один конкурентный вызов на ключ в пределах экземпляра, не между экземплярами | подтверждено |
| `validation`: `SetInheritanceValidator` вместо `When(x is Subtype)` | docs.fluentvalidation.net, "Inheritance": метод есть, с FluentValidation 9.2; каждый подтип добавляется явно | подтверждено; `MaximumLength`, `RuleForEach` отдельно не открывались |
| `logging`: уровни и scope | learn.microsoft.com/dotnet/core/extensions/logging (2026-03-30): Information - "general flow", Debug - "debugging and development", Warning - "abnormal or unexpected events"; scope виден только провайдерам с `IncludeScopes` (Console, AzureAppServices, ApplicationInsights) | согласуется; оговорка о провайдерах в skill не вынесена: Serilog/Seq ведут scope своим обогащением, кейс RV-L1 держится |
| `api-development`: создание ресурса - 201 с `Location` | learn.microsoft.com/aspnet/core/web-api/action-return-types: `CreatedAtAction` даёт 201 и `Location`, `ActionResult<T>.Result`, `ProducesResponseType(201)` (по сводке поиска) | согласуется |
| `async-patterns`: у `File.ReadAllLines` есть асинхронный API | learn.microsoft.com/dotnet/api/system.io.file.readalllinesasync: метод есть (.NET Core 2.0+, по сводке поиска; в .NET Framework нет) | подтверждено для .NET Core и выше |
| `csproj-hygiene`: `CopyLocalLockFileAssemblies` в библиотеке | learn.microsoft.com/dotnet/core/project-sdk/msbuild-props (по сводке поиска, страница не открывалась): по умолчанию false у библиотек | согласуется, не сверено по странице |
| `testing-patterns`, `csproj-hygiene` (кроме выше), `async-patterns` (кроме выше) | - | пункты - названия ситуаций без числовых или версионных утверждений, сверять нечего |

### Парная проба на Sonnet 5.5: текущий skill против без skill

Протокол и команды - `tests/trap-skills/_s7-route/README.md`. Кейс ревью каждого набора, по одному прогону на плечо (`w` - со skill из `develop`, `z` - без), `claude-sonnet-5-5` medium, CLI 2.1.311, засчитывание по ключу кейса вручную. Полосы шума нет (n=1), судьи нет: слабое доказательство.

| Набор, кейс | Ключевых единиц | Со skill | Без skill | Что дал skill |
|---|---:|---:|---:|---|
| code-quality, RV-Q | 9 | 8 | 6 | Q2 (`AnalysisMode` при bulk-категориях), Q8 (аудит без транзитивных); Q5 не поднят ни в одном плече (склейка с Q9 в одной строке, как в прошлых прогонах) |
| resilience, RV-S | 10 | 9 | 8 | S7 (timeout попытки больше срока вызывающего); S1 не поднят ни в одном плече |
| logging, RV-L1 | 8 | 8 | 7 | L20 (контекст в каждой строке вместо `BeginScope`) |
| validation, RV-V | 9 | 9 | 9 | ничего: все ловушки пойманы без skill |
| async-patterns, RV-A (billing) | 8 | 8 | 7 | A4 (`Task.Run` над `ReadAllLines`) |
| api-development, RV-A (pricing) | 19 | 19 | 14 | D1, D3, D9, D10, D18 (логика в action, `IActionResult`, `[Route]`, 201 с `Location`, enum без описания); D11, D12, D14 без skill засчитаны мягко по одной общей находке о схеме маршрутов |
| csproj-hygiene, RV-C | 11 | 11 | 11 | ничего |
| testing-patterns, RV-T | 7 | 7 | 6 | T3 (мок возвращает мок) |
| Итого | 81 | 79 | 68 | |

Приманки (P): провалов нет ни в одном плече. Пограничный случай `rv-s-w1`: находка о стандартном handler батч-клиента ("10 с на попытку короче пачки, повторы POST") по сути - S8, запроса `Idempotency-Key` нет, как провал не засчитана.

Все различия лежат в пунктах, которые skill называет прямо; skill не сужал охват (единицы вне skill - ключи кейса, приманки - не страдают). `validation` и `csproj-hygiene` в этой пробе выигрыша не дали (оба плеча 9/9 и 11/11): это сигнал, но не основание снимать при n=1, без Haiku и без кейсов кода (G3, G-P). `ef-core` не перепроверялся: у набора нет раннера, кейсы E1-E7 собирались вручную.

Различимость `description` (`route.mjs`, 10 skills, 20 реплик): Haiku 5.5 - 100/100 (5 прогонов), Sonnet 5.5 - 20/20 (1 прогон). `dotnet-testing-patterns` и `ts-vitest-jest` не путаются (реплики с Jest/Vitest и с xunit/Moq разведены обоими тирами), поэтому признак стека в `description` не добавлялся; в обоих описаниях стек назван первым словом (".NET unit-тесты", "Vitest/Jest unit-тесты").

Расход платных вызовов: 2,940 USD из 3 (парная проба: со skill 1,235 + без skill 1,204 = 2,439; различимость: Haiku 0,056, Sonnet 0,445).

### Не применено, ждёт серии (платной) или решения

- Снятие `dotnet-validation` (0,8 КБ) и `dotnet-csproj-hygiene` (1,0 КБ): в пробе выигрыша нет (9/9 и 11/11 в обоих плечах). Условие по эпику: нет измеримого выигрыша на обоих тирах - снять по протоколу `tests/trap-skills/removed/`, для этого нужны Haiku и Sonnet, 3 прогона на ячейку, кейсы кода и ревью (G3, RV-V, RV0; G-P, RV-C, RV0) и пересчёт состава бандлов и потребителей. Оценка по `tests/eval55/priors.json` (repo-ячейка: Sonnet 0,153, Haiku 0,0094 USD): 2 skills x 3 кейса x 2 плеча x 3 прогона = 36 ячеек на тир, около 5,5 USD Sonnet и 0,34 USD Haiku. Команды - раннеры из `tests/trap-skills/_projects/billing/run-group-2-1.sh` и `pricing/run-group-2-2.sh` с `--model claude-haiku-5-5` (модель зашита в раннер, меняется строкой `--model`), множества `w`/`z`, номера 1-3.
- Перепроверка `ef-core` (кейсы E1-E7, `dotnet-ef-core/README.md`, входы в `inputs/`): раннера нет, нужна сборка запуска по `prompt-plain.md`; 7 кейсов x 2 плеча x 3 прогона на Sonnet по 0,153 - около 6,4 USD, на Haiku около 0,4 USD.
- Остальные семь наборов: повтор пробы до n=3 на каждом тире для полосы шума (E10 Haiku 0,11, Sonnet 0,14) - Sonnet 16 прогонов x 2 x 0,153 около 4,9 USD, Haiku около 0,3 USD. Кейсы кода (`g-*`) этой пробой не затронуты.
- E7 на паре `dotnet-testing-patterns` / `ts-vitest-jest` и рост библиотеки до 30 и 100 skills: не гонялся (E7 отложен решением владельца, #35).
- `NuGetAuditMode` по TFM, `ClientCascade` по имени, оговорка о провайдерах scope: возможное добавление фактов в skills; не вносилось без свидетельства пользы и при нулевом росте.
