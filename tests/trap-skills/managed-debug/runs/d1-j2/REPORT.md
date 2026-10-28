## Симптом
В /work/logs/worker.log `processed=40` не меняется, `inflight` растёт (105 → 777 за 30 с), CPU 0%, процесс (pid 11, `dotnet app/OrdersWorker.dll hang`) жив.

## Причина
Голодание (starvation) пула потоков: все 8 рабочих потоков (Max = 8, ключ/переменная `ORDERS_MAX_WORKERS`, по умолчанию 8; `ThreadPool.SetMaxThreads` в /work/src/Program.cs:39) заблокированы синхронным ожиданием `Task.Wait` внутри обработчика `Modes.Hang` (лямбда `Hang.b__0`, вызов `prices.GetPrice`, Program.cs ~48). Задача, которую они ждут, должна выполниться на том же пуле, свободных потоков нет, поэтому прогресса нет (sync-over-async deadlock). Новые заказы только копятся в очереди (`inflight`).

## Улики
1. `docker exec diag46-d1-j2 tail /work/logs/worker.log`:
   `16s processed=40 inflight=445 rss=31MB` ... `30s processed=40 inflight=777 rss=52MB`
2. `dotnet-dump collect -p 11` + `dotnet-dump analyze -c threadpool`:
   `Workers Total: 8 / Workers Running: 8 / Workers Idle: 0 / Worker Min Limit: 4 / Worker Max Limit: 8`, `CPU utilization: 0%`
3. `dotnet-dump analyze -c "clrstack -all"`: ровно 8 потоков пула стоят в одном стеке:
   `Monitor.ObjWait <- ManualResetEventSlim.Wait <- Task.SpinThenBlockingWait <- Task.InternalWaitCore <- Modes+<>c__DisplayClass3_1.<Hang>b__0() <- Task<Decimal>.InnerInvoke <- ThreadPoolWorkQueue.Dispatch`
   Главный поток в `Thread.Sleep` в `Modes.Hang()` (Program.cs @ 53) продолжает ставить задачи.

## Что предлагаю
- Срочно: перезапустить orders-worker (после рестарта лимит снова упрётся).
- Исправление в коде: сделать обработчик асинхронным (`await prices.GetPriceAsync(...)`), убрать `.Wait()/.Result` в пути обработки.
- Убрать/увеличить искусственный лимит `ORDERS_MAX_WORKERS` (и не занижать SetMaxThreads), ограничивать параллельность через `SemaphoreSlim`/Channel с backpressure, чтобы `inflight` не рос без границ.
- Добавить алерт на неизменный `processed` при растущем `inflight`.
