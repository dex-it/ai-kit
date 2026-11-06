## Симптом
orders-worker (PID 11, `dotnet app/OrdersWorker.dll hang`) жив, CPU 0%, но `processed` застрял на 40, а `inflight` растёт (102 → 534 за 20 с).

## Причина
Starvation пула потоков: максимум рабочих потоков 8 (`ThreadPool.SetMaxThreads(max, max)`, `ORDERS_MAX_WORKERS`, по умолчанию 8 — Program.cs:37-39). Все 8 потоков заблокированы в обработчике заказа синхронным `GetPriceAsync(sku).Result` (Program.cs:117, вызов из Program.cs:48). Продолжение `await Task.Delay(30)` (Program.cs:113) нужно выполнить на том же пуле, свободных потоков нет, поэтому задачи ждут друг друга. Пул не может расшириться из-за лимита. Это deadlock, а не медленная работа.

## Улики
1. Лог, `tail /work/logs/worker.log`:
```
2s processed=40 inflight=102 rss=27MB
...
16s processed=40 inflight=437 rss=31MB
```
2. `top -H -b -n1 -p 11`: `%Cpu(s): 100.0 id`, все 19 потоков в состоянии sleeping.
3. `dotnet-dump collect -p 11` и `dotnet-dump analyze -c "threadpool"`:
```
Workers Total:    8
Workers Running:  8
Workers Idle:     0
Worker Min Limit: 4
Worker Max Limit: 8
```
4. `dotnet-dump analyze -c "clrstack -all"`: потоки 0x15, 0x17, 0x18, 0x19, 0x1a и другие рабочие потоки пула стоят в одном и том же месте:
```
System.Threading.Tasks.Task.InternalWaitCore(...)
Modes+<>c__DisplayClass3_1.<Hang>b__0()
System.Threading.Tasks.Task`1[[System.Decimal]].InnerInvoke()
System.Threading.ThreadPoolWorkQueue.Dispatch()
```
5. `dotnet-dump analyze -c "dumpasync"`: ожидающие `PriceClient+<GetPriceAsync>d__0` на `Task+DelayPromise` (STACK 1..6). Их продолжения не запускаются, потому что пул занят.

## Что предлагаешь
- Исправление в коде: сделать цепочку асинхронной (`await prices.GetPriceAsync(...)` вместо `.Result`, Program.cs:117 и :48). Потоки пула при этом не блокируются.
- Временная мера: перезапустить сервис с большим `ORDERS_MAX_WORKERS`. Это только откладывает проблему: при росте нагрузки лимит снова будет исчерпан.
- Не оставлять `SetMaxThreads` жёстко ограниченным без необходимости.
- Добавить мониторинг: алерт, если `processed` не растёт, а `inflight` растёт (например, `dotnet-counters`: ThreadPool Queue Length, ThreadPool Thread Count).

Примечание: значение `ORDERS_MAX_WORKERS` в окружении процесса не проверялось, чтение /proc/11/environ было запрещено. Лимит 8 подтверждён через `threadpool` в дампе. Дамп снят в /tmp/d.dmp внутри контейнера.
