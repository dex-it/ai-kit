## Симптом
Лог /work/logs/worker.log: `processed=40` не меняется, `inflight` растёт (102 → 1354 за ~54 с), rss медленно растёт (27 → 40MB). Процесс dotnet (PID 11) жив, CPU ≈ 0.9%.

## Причина
Голодание (starvation) пула потоков, sync-over-async: все 8 воркеров пула заняты задачами, которые блокирующе ждут `Task`, а продолжению этого `Task` нужен свободный поток пула.
- Код: `Program.cs:48` (лямбда в `Task.Run`) вызывает `PriceClient.GetPrice`, а он делает `GetPriceAsync(sku).Result` (`Program.cs:117`). Внутри `await Task.Delay(30)` (`Program.cs:113`) продолжению нужен поток пула.
- Конфигурация: `ThreadPool.SetMaxThreads(max, max)` (`Program.cs:39`), где `max` берётся из переменной окружения `ORDERS_MAX_WORKERS` (по умолчанию 8, `Program.cs:37`). Живой пул ограничен 8 потоками (см. улики). Значение переменной в живом процессе я не читал, потому что доступ к /proc/11/environ запрещён. Файл /work/orders-worker.env не открывал.
- Источник заказов в `Hang()` каждые 1–40 мс ставит новые `Task.Run`, и очередь растёт без предела (`Program.cs:42-53`).

## Улики
1. Лог растущего inflight при неподвижном processed:
`docker exec diag46-d1-k3 tail /work/logs/worker.log`
```
2s processed=40 inflight=102 rss=27MB
22s processed=40 inflight=585 rss=31MB
54s processed=40 inflight=1354 rss=40MB
```
2. Счётчики живого процесса:
`docker exec diag46-d1-k3 sh -c 'dotnet-counters collect -p 11 --counters System.Runtime --refresh-interval 2 --format csv -o /tmp/c.csv'`
```
ThreadPool Thread Count,Metric,8
ThreadPool Queue Length,Metric,766 -> 814 -> 862 -> 911
ThreadPool Completed Work Item Count (Count / 2 sec),Rate,0
```
Очередь растёт, выполненных задач 0, потоков ровно 8 (упёрлись в максимум).
3. Потоки процесса: все TP Worker в `futex_wait` (`/proc/11/task/*/wchan`), CPU не потребляют.
4. Стеки воркеров из дампа:
`dotnet-dump collect -p 11 --type Mini; dotnet-dump analyze /tmp/d.dmp` -> `clrstack -all`
```
System.Threading.Monitor.ObjWait(Int32, System.Object)
System.Threading.Tasks.Task.SpinThenBlockingWait(Int32, System.Threading.CancellationToken)
System.Threading.Tasks.Task.InternalWaitCore(Int32, System.Threading.CancellationToken)
Modes+<>c__DisplayClass3_1.<Hang>b__0()
System.Threading.Tasks.Task`1[[System.Decimal...]].InnerInvoke()
System.Threading.ThreadPoolWorkQueue.Dispatch()
```
Одинаковый стек у всех воркеров (OS Thread Id 0x13, 0x15, 0x17–0x1b и др.): блокирующее ожидание `Task` внутри рабочего элемента пула. Ни один поток не выполняет продолжение `Task.Delay`. Главный поток (0xb) в `Modes.Hang()` (Program.cs:53) продолжает порождать задачи, поток 0x12 — heartbeat.
Замечание: `syncblk` и `threadpool` в SOS по мини-дампу не отработали (`Error requesting SyncBlk data`, `Failed to obtain ThreadPool data`). Вывод опирается на счётчики и стеки.

## Что предлагаю
1. Немедленно: перезапустить orders-worker. Это только снимает симптом, при нагрузке повторится.
2. Исправление в коде (для разработчиков): убрать `.Result` в `PriceClient.GetPrice` (Program.cs:117), сделать цепочку асинхронной (`await prices.GetPriceAsync(...)` в `Task.Run(async () => ...)`).
3. Ограничить приём: заменить безлимитный цикл `Task.Run` (Program.cs:42-53) на ограниченную очередь или `SemaphoreSlim`, чтобы inflight не рос без предела.
4. Не использовать малый `ORDERS_MAX_WORKERS` как «защиту»: при sync-over-async любой предел рано или поздно исчерпывается. Увеличение лишь отодвигает отказ.
5. Мониторинг: алерт на `ThreadPool Queue Length` растущий при `Completed Work Item Count` = 0 и на застывший `processed` в логе.
