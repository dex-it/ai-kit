# Симптом
orders-worker (dotnet, PID 11) жив, но `processed=40` в /work/logs/worker.log не растёт, `inflight` растёт (102 → 584 за 20 с), CPU ~0%, rss стабилен.

# Причина
Голодание (starvation) пула потоков .NET: пул ограничен 8 рабочими потоками (`ORDERS_MAX_WORKERS`, по умолчанию 8; /work/src/Program.cs:37-39), и все 8 заблокированы синхронным ожиданием асинхронного вызова (sync-over-async, `GetPriceAsync(sku).Result`, Program.cs:117, вызывается из Task.Run в Program.cs:46). Продолжение `await Task.Delay(30)` должно выполниться в том же пуле, свободных потоков нет, и задачи ждут друг друга бесконечно.

# Улики
1. Потоки процесса в ожидании (`ps -eLo pid,tid,stat,wchan:20,comm`): все `.NET TP Worker` в `futex_wait`, CPU 0.0.
2. Метрики (`dotnet-counters collect -p 11 --counters System.Runtime`):
   - `ThreadPool Thread Count,Metric,8`
   - `ThreadPool Queue Length,Metric,793 → 841 → 889` (растёт)
   - `ThreadPool Completed Work Item Count (Count / 2 sec),Rate,0`
3. `dotnet-dump analyze` (полный дамп) → `clrstack` у воркеров (потоки 7 и 12, остальные аналогично):
   ```
   System.Threading.Monitor.ObjWait(Int32, System.Object)
   System.Threading.Tasks.Task.SpinThenBlockingWait(...)
   System.Threading.Tasks.Task.InternalWaitCore(...)
   Modes+<>c__DisplayClass3_1.<Hang>b__0()
   System.Threading.Tasks.Task`1[[System.Decimal...]].InnerInvoke()
   System.Threading.ThreadPoolWorkQueue.Dispatch()
   ```
4. `dotnet-dump analyze ... -c threadpool`:
   ```
   Workers Total:    8
   Workers Running:  8
   Workers Idle:     0
   Worker Min Limit: 4
   Worker Max Limit: 8
   ```
5. `syncblk`: удерживаемых мониторов нет, значит это не взаимоблокировка на lock, а исчерпание пула.

# Что предлагаю
- Срочно: перезапустить сервис (потоки сами не освободятся). Дамп/метрики сняты, очередь в памяти будет потеряна. Нужно решить, можно ли переобработать заказы.
- Исправление в коде (за владельцами сервиса): убрать `.Result` и сделать обработчик асинхронным (`await GetPriceAsync(...)`).
- Конфигурация: поднять `ORDERS_MAX_WORKERS` (orders-worker.env) только как временную меру, потому что при достаточной нагрузке потоки закончатся снова.
- Мониторинг: алерт на `ThreadPool Queue Length` растёт при `Completed Work Item Count` = 0, и на стоящий `processed` при растущем `inflight`.
