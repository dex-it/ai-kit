# dotnet-resilience: сжатие по свидетельству, группа 2.2

Скилл `dex-skill-dotnet-resilience` 1.1.1 ([`inputs/SKILL-1.1.1.md`](inputs/SKILL-1.1.1.md)), эпик #291,
группа 2.2 (#297). Итог - 1.2.0 ([`inputs/SKILL-1.2.0.md`](inputs/SKILL-1.2.0.md)): семь пунктов из 12
ловушек и пункт H1, перенесённый из снятого `dotnet-caching`.

## Заход группы 2.2

Общий для пяти скиллов: `dotnet-testing-patterns`, `dotnet-api-development`, `dotnet-csproj-hygiene`,
`dotnet-resilience`, `dotnet-caching`.

**Вход.** Мини-проект [`_projects/pricing`](../_projects/pricing/README.md), ветки `branches/<имя>`.
Ключ, коды единиц и допустимые решения записаны до первого прогона. Кейсы скилла: G-R (код), RV-S
(ревью); приманки RV0 (P0-S, P0-S2) и G0.

**Исполнитель.** `claude -p`, `--model claude-sonnet-5-5 --effort medium --restricted
--strict-mcp-config --no-session-persistence --disable-slash-commands --permission-mode acceptEdits
--max-budget-usd 3`, инструменты `Read, Write, Edit, Glob, Grep, Bash`. Разрешён только `Bash(git *)`,
кодовым кейсам ещё `Bash(dotnet *)`. Промпты - [`run-group-2-2.sh`](../_projects/pricing/run-group-2-2.sh).
Редакции всех скиллов группы поданы каждому прогону со скиллом копиями `SKILL.md` через `--add-dir`,
`Skill` tool не вызывается. Выходы - `runs/<кейс>-<набор><N>/`, ревью-кейс RV0 - в
[`dotnet-api-development/runs`](../dotnet-api-development/runs), G-H - в
[`removed/dotnet-caching/runs`](../removed/dotnet-caching/runs).

**Resilience-тройка** (#297, «До кейсов»): `distributed-resilience` и `microservices` сняты группой 1.2
(#294, протоколы [removed/distributed-resilience](../removed/distributed-resilience/README.md),
[removed/microservices](../removed/microservices/README.md)) - тройки нет, предмет только здесь.

## Потребители

Бандлы `dotnet-developer`, `dotnet-fullstack`; `architect-dotnet` (Skill tool в фазе и README);
by-stack через `stack-registry`: `discover-reviewer`. Кейс активации `dotnet-resilience-in`.

## Контроль

Без скилла, 2 прогона на кейс (`c1`, `c2`). Единица снята, если 2/2 в каждом кейсе, где клетка
применима.

| Единица | Кейс | Контроль | Исход |
|---|---|---|---|
| S1 политика на листе вместо корня | G-R, RV-S | 1/2, 0/2 | мерится: `c2` G-R - `CancelAfter` в `QuoteService`; в RV-S место `CurrencyConverter` не названо |
| S2 матрёшка повторов | G-R, RV-S | 2/2, 2/2 | снята |
| S3 повтор неидемпотентного | G-R | 2/2 | снята: `Idempotency-Key` из заказа и SKU в обоих |
| S4 повтор на 4xx | RV-S | 2/2 | снята |
| S5 без jitter / backoff | RV-S | 2/2 | снята |
| S6 timeout на попытку без общего | RV-S | 1/2 | мерится |
| S7 timeout больше срока вызывающего | G-R, RV-S | 1/2, 2/2 | мерится: `c2` G-R - 1 с на строку, строки последовательно |
| S8 фиксированный timeout батча | RV-S | 2/2 | снята |
| S9 нет circuit breaker | RV-S | 1/2 | мерится |
| S10 `catch (Exception)` | G-R, RV-S | 2/2, 1/2 | мерится |
| S11 нет метрик | RV-S | Н | не мерилась: телеметрия Polly пишется по умолчанию, K-клетки нет |
| S12 тихий fallback | G-R, RV-S | 0/2, 2/2 | мерится: `catch` -> `null` без лога в обоих G-R |
| Чек-лист | - | повтор ловушек | снят |

## Вердикт

| Набор | Редакция | Прогоны |
|---|---|---|
| `n` | [`SKILL-n1.md`](inputs/SKILL-n1.md): семь пунктов-названий и H1 «Конкурентные промахи кэша идут в зависимость каждый» | G-R, RV-S, G-H, RV-H, RV0 по 2 |
| `m` | [`SKILL-n2.md`](inputs/SKILL-n2.md): H1 со ступенью-фактом «`IMemoryCache.GetOrCreate(Async)` не атомарен, `Lazy` внутри его фабрики вызов не делит» | G-H по 2 |
| `f` | 1.2.0 = `n2`, пункт fallback «без лога и без метрики» вместо «без лога или метрики» | G-R, RV-S, G-H, RV-H, RV0 по 2 |

| Единица 1.1.1 | Кейс | Контроль | n | f | Исход |
|---|---|---|---|---|---|
| S1 | G-R, RV-S | 1/2, 0/2 | 1/2, 2/2 | 1/2, 2/2 | пункт-название; G-R держится на уровне контроля (`CancelAfter` в `QuoteService` в `n2`, `f1`) |
| S6 | RV-S | 1/2 | 2/2 | 2/2 | пункт-название |
| S7 | G-R, RV-S | 1/2, 2/2 | 2/2, 2/2 | 2/2, 2/2 | пункт-название |
| S9 | RV-S | 1/2 | 2/2 | 2/2 | пункт-название |
| S10 | G-R, RV-S | 2/2, 1/2 | 2/2, 2/2 | 2/2, 2/2 | пункт-название |
| S11 | RV-S | Н | Н | Н | пункт-название, открыто |
| S12 | G-R, RV-S | 0/2, 2/2 | 2/2, 2/2 | 1/2 спорно, 2/2 | пункт-название |
| H1 (из `dotnet-caching`) | G-H | 0/2 | 1/2 | `m` 2/2, `f` 2/2 | пункт-название с фактом |
| S2-S5, S8 | см. «Контроль» | 2/2 | 2/2 | 2/2 | сняты |

**Пункт fallback.** В `n1` пункт «без лога или метрики» читался и как «без лога или без метрики»: fallback с логом, но без метрики
попадал под пункт, а исходная ловушка 1.1.1 («Silent swallow») судит fallback без следа вовсе. В `f`
формулировка возвращена к исходнику.

**H1.** В `n2` G-H - `Lazy` внутри `IMemoryCache.GetOrCreate`, как контроль `c1`: название пункта
решение не исключает. Ступень-факт сверена по learn.microsoft.com - строка в таблице фактов
[ключа](../_projects/pricing/README.md#факты-на-которые-опирается-ключ). С ней коалесцирование - `m`
2/2, `f` 2/2 (`ConcurrentDictionary` с TCS или `Lazy` вне `IMemoryCache`, грузит только вставивший).
H2, H4, O-H 2/2 во всех наборах. Решение о снятии `dotnet-caching` - в его
[протоколе](../removed/dotnet-caching/README.md).

**S12 `f1` спорно.** Отдельный вызов оставляет лог и метрику, но путь «срок вышел» уходит в
`catch (OperationCanceledException) when (!ct.IsCancellationRequested)` и возвращает `null` без следа.
Засчитано минусом; контроль 0/2, `n` и `f` 3/4.

**Приманки.** RV-S: P-S1 (повтор POST батча-чтения) и P-S2 (стандартный хендлер) не провалены ни в
одном прогоне. G0 - G0-P 4/4. RV0: P0-S - не провален; P0-S2 провален в `rv0-q4` (набор `q`
протокола [`dotnet-csproj-hygiene`](../dotnet-csproj-hygiene/README.md)): major «fallback невидим
вызывающему» на базовой цене, которую требует задача. Со скиллом 1 из 10 прогонов RV0 (`n`, `f`, `q`,
`r`); контроль и `n` ставят ту же находку minor - наблюдение, не реакция.

## Открыто

- S11: название держится без свидетельства, K-клетки в кейсах нет.
- S12 `f1`: след пути «срок вышел» - спорный минус.
- P0-S2: major 1/10, реакции нет.

## Расход группы 2.2

CLI 2.1.296, сумма по логам прогонов - $24.56 за 122 прогона (суммы наборов округлены).

| Набор | Прогоны | Расход | Состав |
|---|---|---|---|
| `c` | 36 | $5.99 | контроль 24, фикстура RV0 - 4 перепрогона, RV-A `c3`, `c4`, RV-C `c3`-`c6`, G-P `c3`, `c4` |
| `n` | 24 | $4.94 | первые ревизии, все кейсы по 2 |
| `m` | 8 | $2.04 | G-H, RV-A, RV-C, G-P по 2 |
| `p` | 4 | $1.06 | api `n2`: RV-A, G-A по 2 |
| `f` | 24 | $5.29 | итоговые редакции, все кейсы по 2 |
| `q` | 8 | $1.39 | csproj `n2`: RV-C, RV0 по 4 |
| `r` | 8 | $1.81 | csproj `n3`: RV-C 4, G-P 2, RV0 2 |
| `t` | 6 | $1.71 | csproj `n4`: G-P 4, RV-C 2 |
| `k1` | 4 | $0.32 | api D20: K1 из `removed/dotnet-di`, контроль 2, редакция с пунктом 2 |

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `dotnet-resilience/SKILL.md` | 6956 символов, 89 строк | 995 символов, 17 строк | 12 ловушек и чек-лист -> 7 пунктов-названий и H1 из `dotnet-caching` |
| `description` | Polly, retry, timeout | предмет восьми пунктов | кейс активации `dotnet-resilience-in` переведён на предмет пунктов, 3/3 |

Норма письма (`dex-skill-norm-writing`): носитель меньше, чем до правки; пункт - одно предложение,
называет ситуацию, решение выводит исполнитель. Рез через `dex-skill-optimize-for-llm` пройден на
редакции перед прогоном.

## Бюджет синхронизаций группы 2.2

Носители, тронутые синхронизациями пяти скиллов группы, символы и строки, develop (`a9897f6d`) ->
ветка. Выросли пять строк потребителей: прежняя строка называла предмет, которого в скилле больше нет
(CPM, `PrivateAssets`, Polly, DTO, AAA), новая называет предмет пунктов, и короче он не выражается -
`budget-exceeded`. `api-documentation` вырос заменой ложного «Swashbuckle молча игнорирует» на два
исхода из зонда группы (500 при `IncludeXmlComments`, пустая схема без него). Фикстура
`analyze-quality-gate.md` выросла заменой примера: прежний ссылался на снятые `linq-optimization` и раздел
«Фильтры», новый назван полностью - `budget-exceeded`.

| Носитель | develop | ветка | Разница |
|---|---|---|---|
| `README.md` | 28423, 479 | 28405, 479 | -18 |
| `marketplace.json` | 107982, 3159 | 107597, 3146 | -385 |
| `tests/activation/cases.json` | 30018, 719 | 29947, 713 | -71 |
| `architect-dotnet.md` | 17356, 273 | 17360, 273 | +4 |
| `dex-architect-dotnet/README.md` | 3897, 62 | 3896, 62 | -1 |
| `dotnet-coder.md` | 13448, 147 | 13459, 147 | +11 |
| `dotnet-test-writer.md` | 11835, 129 | 11840, 129 | +5 |
| `test-automator.md` | 8575, 100 | 8558, 100 | -17 |
| `dotnet-quality-auditor.md` | 6441, 85 | 6479, 85 | +38 |
| `api-documentation/SKILL.md` | 3698, 72 | 3774, 72 | +76 |
| `analyze-quality-gate.md` | 6565, 99 | 6866, 99 | +301 |
| `test-fixtures/README.md` | 2028, 30 | 2032, 30 | +4 |
