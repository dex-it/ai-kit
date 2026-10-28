# REPORT: orders-worker

## Симптом
Процесс dotnet (PID 11, `dotnet app/OrdersWorker.dll hang`) жив, но `processed` в /work/logs/worker.log застыл на 40, а `inflight` растёт примерно на 49 за 2 с (103 → 732 за 28 с). RSS около 31MB, CPU около 0.6%. Все потоки пула спят в futex_wait.

## Причина
Истощение пула потоков (sync-over-async). Максимум потоков пула ограничен значением `ORDERS_MAX_WORKERS` (по умолчанию 8): `Program.cs:38-39`, `SetMaxThreads(max, max)`. Каждая задача из `Task.Run` (`Program.cs:46-48`) блокирует рабочий поток вызовом `prices.GetPrice(...)`. Он определён как `GetPriceAsync(sku).Result` (`Program.cs:117`). Продолжение после `await Task.Delay(30)` (`Program.cs:111-113`) должно выполниться на том же пуле. Свободных потоков нет, потому что все 8 заняты ожиданием, поэтому ни одна задача не завершается. Лимит `ORDERS_MAX_WORKERS` из окружения процесса я не читал. Его значение выведено по числу потоков пула в дампе и счётчику (8).

## Улики
1. Счётчики (`dotnet-counters collect -p 11 --counters System.Runtime`):
```
ThreadPool Thread Count,Metric,8
ThreadPool Queue Length,Metric,1109   (позже 1157)
ThreadPool Completed Work Item Count (Count / 2 sec),Rate,0
Monitor Lock Contention Count (Count / 2 sec),Rate,0
```
Очередь растёт, завершённых элементов нет, потоков ровно 8.

2. Дамп (`dotnet-dump collect -p 11`, затем `dotnet-dump analyze`, команда `clrstack -all`). Все 8 рабочих потоков пула стоят в одном и том же стеке:
```
System.Threading.Monitor.ObjWait(Int32, System.Object)
System.Threading.Tasks.Task.SpinThenBlockingWait(...)
System.Threading.Tasks.Task.InternalWaitCore(...)
Modes+<>c__DisplayClass3_1.<Hang>b__0()
System.Threading.Tasks.Task`1[[System.Decimal]].InnerInvoke()
System.Threading.ThreadPoolWorkQueue.Dispatch()
```
Основной поток в это время находится в `Modes.Hang() Program.cs @ 53` (`Thread.Sleep`) и продолжает ставить новые задачи в очередь.

3. `/proc/11/task/*/wchan`: потоки `.NET TP Worker` стоят в `futex_wait`.

## Что предлагаю
1. Убрать блокировку: в `Program.cs:48` и `:117` сделать цепочку асинхронной (`async` лямбда в `Task.Run` с `await GetPriceAsync(...)`, а `GetPrice` убрать или заменить на `GetPriceAsync`).
2. Ограничить приём: сейчас producer (`Program.cs:42-53`) не смотрит на `inflight`. Нужен bounded channel или семафор.
3. Временная мера: перезапустить сервис. Поднять `ORDERS_MAX_WORKERS` можно, но это только отсрочка, потому что очередь растёт быстрее. Код и конфигурацию я не менял.
