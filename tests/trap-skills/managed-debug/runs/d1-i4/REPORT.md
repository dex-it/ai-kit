## Симптом
orders-worker (PID 11, `dotnet app/OrdersWorker.dll hang`) жив, но `processed=40` не меняется, а `inflight` растёт примерно на 48 за 2 с (393 → 585). RSS около 31MB, CPU около 0.7%. Процесс не занят работой, он ждёт.

## Причина
Starvation пула потоков (sync-over-async). Задача в `Task.Run` вызывает `PriceClient.GetPrice`, а тот блокируется на `GetPriceAsync(sku).Result`. Это `/work/src/Program.cs:117`, вызов из лямбды на строках 46–52 (`Modes.Hang`).

Пул ограничен `ThreadPool.SetMaxThreads(max, max)` (`Program.cs:39`), по умолчанию max = 8 (ключ окружения `ORDERS_MAX_WORKERS`, `Program.cs:36`). Все 8 рабочих потоков заблокированы в `.Result` и ждут продолжения `await Task.Delay(30)`. Продолжению нужен свободный поток пула, а свободных нет. Это взаимная блокировка, сама она не пройдёт. Главный цикл при этом продолжает ставить задачи в очередь (`inflight` растёт).

Значение `ORDERS_MAX_WORKERS` в запущенном процессе я не читал: чтение /proc/11/environ было заблокировано. Но живой процесс показывает ровно 8 потоков `.NET TP Worker`, и все они заблокированы, так что лимит равен 8.

## Улики
1. Лог, `docker exec diag46-d1-i4 tail -5 /work/logs/worker.log`:
   ```
   14s processed=40 inflight=393 rss=31MB
   22s processed=40 inflight=585 rss=31MB
   ```
2. Состояние потоков живого процесса:
   ```
   docker exec diag46-d1-i4 sh -c 'for t in /proc/11/task/*; do echo $(cat $t/comm) $(awk "{print \$3}" $t/stat) $(cat $t/wchan); done | sort | uniq -c'
         8 .NET TP Worker TP futex_wait
         1 .NET TP Gate TP futex_wait
   ```
   Все 8 рабочих потоков спят на futex, CPU они не используют.
3. Стеки управляемых потоков из дампа живого процесса:
   ```
   docker exec diag46-d1-i4 dotnet-dump collect -p 11 --type Mini
   docker exec diag46-d1-i4 dotnet-dump analyze /tmp/w.dmp -c "clrstack -all"
   OS Thread Id: 0x13 (и 0x14, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c — те же кадры)
     System.Threading.Monitor.ObjWait(Int32, System.Object)
     System.Threading.Tasks.Task.SpinThenBlockingWait(...)
     System.Threading.Tasks.Task.InternalWaitCore(...)
     Modes+<>c__DisplayClass3_1.<Hang>b__0()
     System.Threading.Tasks.Task`1[[System.Decimal]].InnerInvoke()
     System.Threading.ThreadPoolWorkQueue.Dispatch()
   ```
   Основной поток при этом спокойно спит в `Modes.Hang() [Program.cs @ 53]` (`Thread.Sleep`) и продолжает добавлять задачи.
4. Команды `dotnet-counters` и SOS `threadpool` ничего полезного не вернули ("Failed to obtain ThreadPool data" на мини-дампе). Поэтому счётчики очереди и завершённых задач я не смотрел. Вывод основан на стеках и состоянии потоков.

## Что предлагаю
- Убрать блокировку: в `PriceClient` сделать `GetPrice` асинхронным (`await GetPriceAsync(...)`) и в `Hang` использовать `async`-лямбду в `Task.Run`. Править код я не стал.
- Не заменять `.Result` на `.GetAwaiter().GetResult()` и не отсекать проблему увеличением `ORDERS_MAX_WORKERS`: так starvation только отодвигается.
- Чтобы вернуть работу сразу: перезапустить процесс. Накопившиеся в очереди заказы после перезапуска надо обработать повторно.
- Добавить алерт на рост `inflight` при неизменном `processed`.
