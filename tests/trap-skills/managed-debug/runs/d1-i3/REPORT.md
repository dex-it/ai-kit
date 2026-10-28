## Симптом
Лог /work/logs/worker.log: `processed=40` не меняется, `inflight` растёт (103 → 686 за ~26 с), rss ~31MB. Процесс dotnet (PID 11) жив, ЦП почти не занят, все потоки спят в futex_wait.

## Причина
Голодание (starvation) пула потоков. Пул ограничен `ORDERS_MAX_WORKERS=8` (/work/orders-worker.env; применяется в /work/src/Program.cs:37-39, `SetMaxThreads(8, 8)`). Каждый обработчик синхронно блокирует рабочий поток: `GetPriceAsync(sku).Result` (/work/src/Program.cs:117). Продолжение после `await Task.Delay(30)` (строка 113) нужно выполнить на потоке пула, а все 8 потоков заняты ожиданием таких же задач. Пул не может расшириться выше максимума, поэтому взаимная блокировка постоянная. Новые задачи ставятся из Program.cs:46 быстрее, чем что-либо завершается.

## Улики
1. `docker exec diag46-d1-i3 sh -c 'tail -n 3 /work/logs/worker.log'`
   `24s processed=40 inflight=635 rss=31MB` / `26s processed=40 inflight=684 rss=31MB`
2. `/proc/11/task/*/comm` и `wchan`: потоки `.NET TP Worker` — `futex_wait`, ЦП не занят (0.7%).
3. `dotnet-dump collect -p 11`, затем `dotnet-dump analyze` → `clrstack -all`. Восемь потоков пула стоят в одном и том же стеке:
   ```
   System.Threading.Monitor.ObjWait
   System.Threading.Tasks.Task.SpinThenBlockingWait
   System.Threading.Tasks.Task.InternalWaitCore
   Modes+<>c__DisplayClass3_1.<Hang>b__0()
   System.Threading.Tasks.Task`1[System.Decimal].InnerInvoke()
   ```
4. `threadpool` в dotnet-dump: `Workers Total: 8`, `Workers Running: 8`, `Workers Idle: 0`, `Worker Min Limit: 4`, `Worker Max Limit: 8`.
5. Основной поток — `Thread.Sleep` в `Modes.Hang()` (цикл постановки задач); потока, способного выполнить продолжение `Task.Delay`, нет.

## Что предлагаю
- Корректное исправление в коде (вне моих полномочий): убрать блокирующий `.Result` в `PriceClient.GetPrice`, сделать обработчик асинхронным (`await GetPriceAsync(...)`).
- Операционная мера: перезапустить сервис. Поднять `ORDERS_MAX_WORKERS` можно только как временную меру, потому что блокировка остаётся и при большем лимите упрёмся в него же при нагрузке.
- Добавить мониторинг: `dotnet-counters` по `threadpool-queue-length` и `threadpool-completed-items-count`, алерт на рост `inflight` при неизменном `processed`.
