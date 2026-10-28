# REPORT: orders-worker не обрабатывает заказы

## Симптом
Процесс `dotnet app/OrdersWorker.dll hang` (PID 11) жив, состояние S, CPU 0%. В `/work/logs/worker.log` `processed=40` не меняется, а `inflight` растёт примерно на 49 за 2 с (104 → 639). Память почти не растёт (27 → 31 МБ).

## Причина
Пул потоков исчерпан (thread pool starvation). Все 8 рабочих потоков пула заблокированы в синхронном ожидании: `PriceClient.GetPrice` вызывает `GetPriceAsync(sku).Result` (Program.cs:117). Это ожидание стоит внутри задач `Task.Run` в `Modes.Hang()` (Program.cs:44-50). Потолок пула в 8 потоков задан ключом конфигурации `ORDERS_MAX_WORKERS` (по умолчанию 8) через `ThreadPool.SetMaxThreads(max, max)` (Program.cs:36-39). Продолжение асинхронного вызова поставлено в тот же пул и не может получить поток, поэтому ожидание не завершается. Новые задачи копятся в очереди.

Значение `ORDERS_MAX_WORKERS` в окружении процесса я не читал: доступ к `/proc/11/environ` был отклонён. Лимит 8 подтверждён дампом: `Worker Max Limit: 8`. Фактическое значение ключа не проверено.

## Улики
1. Лог (`tail /work/logs/worker.log`):
   ```
   2s  processed=40 inflight=104 rss=27MB
   12s processed=40 inflight=350 rss=31MB
   24s processed=40 inflight=639 rss=31MB
   ```
2. Снят дамп живого процесса: `dotnet-dump collect -p 11`, затем `dotnet-dump analyze -c threadpool`:
   ```
   Workers Total:    8
   Workers Running:  8
   Workers Idle:     0
   Worker Min Limit: 4
   Worker Max Limit: 8
   CPU utilization:  0%
   ```
3. `dotnet-dump analyze -c "clrstack -all"`: потоки пула стоят на одном стеке (повторяется на всех рабочих потоках):
   ```
   System.Threading.Monitor.ObjWait
   System.Threading.Tasks.Task.SpinThenBlockingWait
   System.Threading.Tasks.Task.InternalWaitCore
   Modes+<>c__DisplayClass3_1.<Hang>b__0()
   System.Threading.Tasks.Task`1[[System.Decimal]].InnerInvoke()
   System.Threading.ThreadPoolWorkQueue.Dispatch()
   ```
   Главный поток в это время выполняет `Modes.Hang()` на `Thread.Sleep` (Program.cs:53) и продолжает добавлять работу.
4. `dotnet-dump analyze -c syncblk` показывает пустую таблицу: удерживаемых managed-мониторов нет. Это не deadlock на lock, а исчерпание пула.
5. Для сверки: `Program.cs:117` (`GetPriceAsync(sku).Result`), `Program.cs:36-39` (`ORDERS_MAX_WORKERS`, `SetMaxThreads`).

Попытка `dotnet-counters monitor` вывода не дала, поэтому метрики очереди пула в улики не входят.

## Что предлагаю
1. Убрать блокирующий вызов `.Result` в `GetPrice` (Program.cs:117). Сделать обработчик асинхронным и ждать `await GetPriceAsync(...)`. Это основная правка.
2. Убрать искусственный потолок `SetMaxThreads(max, max)` или поднять `ORDERS_MAX_WORKERS`. Это только смягчает проблему и без п.1 её не устраняет.
3. Добавить в мониторинг `ThreadPool.PendingWorkItemCount` и сигнал при росте `inflight` без роста `processed`.
4. Для восстановления сейчас: перезапустить сервис. Он вернётся в то же состояние, пока не внесена правка из п.1.

Код и конфигурацию сервиса я не менял. Дамп `/tmp/w.dmp` внутри контейнера удалён.
