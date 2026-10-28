## Симптом
orders-worker (dotnet, PID 11): `processed=40` не меняется, `inflight` растёт (103 -> 680 за ~24 с), процесс жив (State S, CPU ~0%, RSS ~31MB).

## Причина
Голодание (starvation) ThreadPool: все рабочие потоки пула (лимит 8) заняты синхронным ожиданием асинхронного вызова, а продолжение, которое должно их освободить, ждёт в очереди свободного потока (дедлок на пуле).
- Лимит: ключ конфигурации `ORDERS_MAX_WORKERS=8` (orders-worker.env), применяется как `ThreadPool.SetMaxThreads(max, max)` (src/Program.cs:39).
- Блокировка: `GetPriceAsync(sku).Result` (src/Program.cs:117), вызывается из `Task.Run` в обработчике (src/Program.cs:44-50).

## Улики
1. Лог: `docker exec diag46-d1-i2 tail /work/logs/worker.log`
   `2s processed=40 inflight=103` ... `26s processed=40 inflight=679`
2. Пул: `dotnet-dump collect -p 11` + `dotnet-dump analyze`, команда `threadpool`:
   `CPU utilization: 0%  Workers Total: 8  Workers Running: 8  Workers Idle: 0  Worker Min Limit: 4  Worker Max Limit: 8`
3. Стеки: `clrstack -all` — 8 потоков пула (OS id 0x13, 0x15, 0x17, 0x18, ...) стоят в одном и том же месте (число таких стеков: `grep -c "Hang>b__0"` = 8):
   `System.Threading.Monitor.ObjWait` <- `ManualResetEventSlim.Wait` <- `Task.SpinThenBlockingWait` <- `Task.InternalWaitCore` <- `Modes+<>c__DisplayClass3_1.<Hang>b__0()` <- `Task<Decimal>.InnerInvoke()` <- `ThreadPoolWorkQueue.Dispatch()`
4. `syncblk`: `Total 57, MonitorHeld` пусто — обычных lock-ов нет, ожидание только на Task. Главный поток (0xb) в `Thread.Sleep` (Modes.Hang, Program.cs:53), т.е. продолжает порождать задачи -> растёт `inflight`.

## Что предлагаю
1. Убрать блокировку: в обработчике `await prices.GetPriceAsync(...)` (сделать метод публичным/async) вместо `.Result`; `Task.Run` с async-лямбдой. Это правка кода — не делал, нужно решение владельца.
2. Не ограничивать пул искусственно: убрать/увеличить `ORDERS_MAX_WORKERS` (временная мера: поднять значение и перезапустить — только отсрочит, т.к. поток-источник создаёт задачи быстрее, чем они завершаются).
3. Ограничить приток (bounded channel / семафор) вместо неограниченного роста `inflight`.
4. Мониторинг: алерт на `threadpool-queue-length` растёт при неменяющемся `threadpool-completed-items-count`.
5. Для восстановления сейчас — перезапуск процесса (потеря ~680 in-flight задач в памяти; учесть идемпотентность).

Примечание: снят полный дамп /tmp/w.dmp внутри контейнера (кратковременная пауза процесса на ~31MB).
