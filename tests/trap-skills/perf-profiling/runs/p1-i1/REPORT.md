# REPORT

## Симптом
orders-worker (`dotnet app/OrdersWorker.dll slow`): p50 вырос с 0.2 до 3 мс. Процесс CPU-bound: `top -H` — два рабочих потока по ~100% CPU (us=100%, sy=0), остальные потоки спят. `strace -f -c` за 5 с: системное время не доминирует (futex/membarrier — фон, openat/read — единицы), т.е. время уходит в пользовательском коде, а не в I/O или блокировках.

## Причина
`src/Program.cs:162` — `TextUtils.Slugify` на каждый вызов создаёт `new Regex(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)")` (разбор паттерна и построение интерпретатора каждый раз), вместо одного статического/кэшированного экземпляра. Вызывается из горячего цикла обработчика, `src/Program.cs:98`.

## Улики
1. Нагрузка по потокам: `docker exec diag46-p1-i1 top -H -b -n1 -p 11`
   `20 root ... R 99.9 dotnet` / `19 root ... R 93.3 dotnet`, `%Cpu(s): 100.0 us, 0.0 sy`
2. Системные вызовы: `strace -f -c -p 11` (5 с) — `81.26% futex 7812 calls`, `openat 582`, `read 539`; рабочих syscall'ов, объясняющих задержку, нет.
3. Сэмплирование управляемых стеков (perf недоступен: `perf_event_paranoid>=2`, запись пустая), поэтому:
   `dotnet-trace collect -p 70 --providers Microsoft-DotNETCore-SampleProfiler:0xFFFFFFFFFFFFFFFF:5 --duration 00:00:08 --format Speedscope`
   Разбор по обоим рабочим потокам (инклюзивное время из 8004 ед. на поток):
   - `OrdersWorker!TextUtils.Slugify(String)` — 7990 (99.8%) и 7983
   - `System.Text.RegularExpressions.Regex..ctor(String,CultureInfo)` — 5332 (66.6%) и 5699 (71%)
   - в стеке также `RegexParser.ScanRegex()`
   Т.е. ~2/3 всего времени — конструирование Regex, остальное — `Replace` по свежему экземпляру.
4. Журнал `logs/worker.log`: ~0.9 млн обработок за 2 с на два потока при 100% CPU — полностью занятые ядра.

## Что предлагаю
Вынести Regex в `static readonly` поле (`private static readonly Regex Rx = new(..., RegexOptions.Compiled)` или `[GeneratedRegex]`) и вызывать `Rx.Replace(...)`. После правки повторить `dotnet-trace` и сравнить p50 с базовым 0.2 мс. Код не менял.
Примечание: для снятия профиля сервис был перезапущен (с `DOTNET_PerfMapEnabled=1`), прежний процесс остановлен.
