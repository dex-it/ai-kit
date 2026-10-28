# REPORT: orders-worker

## Симптом
В /work/logs/worker.log `processed=40` не меняется, `inflight` растёт (104 → 589 за 20 с), RSS около 31MB. Процесс `dotnet app/OrdersWorker.dll hang` (PID 11) жив.

## Причина
Starvation пула потоков. Пул ограничен `ORDERS_MAX_WORKERS=8` (/work/orders-worker.env), в коде это `ThreadPool.SetMaxThreads(max, max)` (Program.cs:39). Все 8 рабочих потоков заняты задачами `Task.Run`, которые синхронно блокируются через `GetPriceAsync(sku).Result` (Program.cs:117, вызов из Program.cs:48). Continuation после `await Task.Delay(30)` (Program.cs:113) нужно выполнить на том же пуле, а свободных потоков нет. Получается deadlock: потоки ждут задачи, а задачи ждут потоки.

## Улики
1. Потоки процесса. Все 8 `.NET TP Worker` стоят в futex_wait, а пул не может вырасти выше 8:
   `docker exec diag46-d1-i1 sh -c 'for t in /proc/11/task/*; do echo $(cat $t/comm) $(awk "{print \$3}" $t/stat) $(cat $t/wchan); done | sort | uniq -c'`
   ```
   8 .NET TP Worker TP futex_wait
   1 .NET TP Gate TP futex_wait
   ```
2. Дамп и стек рабочих потоков:
   `dotnet-dump collect -p 11 --type Mini`, затем `dotnet-dump analyze -c "setthread 7" -c "clrstack"`. Потоки 7 и 12 дали одинаковый стек:
   ```
   System.Threading.Monitor.ObjWait(Int32, System.Object)
   System.Threading.Tasks.Task.SpinThenBlockingWait(Int32, CancellationToken)
   System.Threading.Tasks.Task.InternalWaitCore(Int32, CancellationToken)
   Modes+<>c__DisplayClass3_1.<Hang>b__0()
   System.Threading.Tasks.Task`1[[System.Decimal]].InnerInvoke()
   System.Threading.ThreadPoolWorkQueue.Dispatch()
   ```
   `clrthreads` показывает те же 8 `Threadpool Worker` в таком состоянии. Heartbeat-поток при этом живой (`Thread.Sleep`, Program.cs:26).
3. Лог:
   ```
   2s processed=40 inflight=104
   22s processed=40 inflight=589
   ```

## Что предлагаю
1. Убрать блокировку в обработчике. Сделать `Task.Run(async () => await prices.GetPriceAsync(...))` и сделать `GetPriceAsync` публичным, вместо `GetPrice(...) => ...Result` (Program.cs:117). Заодно ограничить число одновременных заказов, например через `SemaphoreSlim`, потому что inflight сейчас не ограничен.
2. Для быстрого восстановления перезапустить сервис и увеличить `ORDERS_MAX_WORKERS`. Это только смягчает проблему: при тех же темпах поступления пул снова забьётся.
3. Код и конфигурацию я не менял. Правки нужно вносить через команду разработки.
