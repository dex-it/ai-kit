Манифесты для DPT-11 написаны, ничего не закоммичено. Ни манифесты, ни `kubectl apply` я не проверял: сборки и кластера нет, а доступен был только git.

**Новые файлы**
- `deploy/k8s/00-namespace.yaml` — namespace `depot`.
- `deploy/k8s/api.yaml` — Deployment `depot-api` (3 реплики), Service, PodDisruptionBudget и Ingress.
- `deploy/k8s/worker.yaml` — Deployment `depot-worker`.
- `deploy/secret.example.yaml` — шаблон Secret `depot-config` с плейсхолдерами. Лежит вне `deploy/k8s/`, поэтому `kubectl apply -f deploy/k8s/` его не применяет.

**Что сделано**
- **Выкат без простоя:** `maxUnavailable: 0`, `maxSurge: 1`. PDB с `minAvailable: 2` защищает от еженедельного drain нод. Реплики распределяются по нодам через `topologySpreadConstraints`. Перед остановкой пода стоит `preStop sleep 5`.
- **Пробы:**
  - Liveness — `tcpSocket` на порт 8080, в БД не ходит. Единственный health-маршрут `/health` делает `select 1`, и при падении Postgres перезапускались бы все поды.
  - Readiness — `/health`.
  - `startupProbe` даёт до 150 с на миграции (холодный старт до 35 с).
- **Ресурсы:** request 100m CPU и 384Mi памяти, limit 1 CPU и 768Mi. Рабочий набор около 300 МБ, так что 768Mi даёт запас под .NET. CPU-limit не занижен: throttling вредит .NET на старте.
- **Секреты:** значений в манифестах нет, контейнеры берут их из Secret `depot-config` через `envFrom`. Этот Secret надо создать вручную до `apply`: команда `kubectl create secret generic` в комментарии шаблона, значения для stage в `docs/stage-values.md`. Пока Secret не создан, поды не стартуют. Значения в `docs/stage-values.md` помечены FAKE, но я не стал класть их в манифест, раз оператора секретов нет.
- **Worker:** ровно один экземпляр, `strategy: Recreate`, чтобы при выкате не работали два экземпляра сразу.
- **Безопасность:** запуск под uid 1654, `readOnlyRootFilesystem`, `emptyDir` на `/tmp`, `capabilities` сброшены.

**Замечания к задаче**
1. `Program.cs` не обрабатывает `--worker`: аргумент попадёт в `WebApplication.CreateBuilder(args)`, и процесс просто запустится как второй API. Runbook описывает режим worker, но в коде его нет. Эту часть нужно уточнить у разработчиков до выкатки.
2. У worker нет проб: по коду непонятно, слушает ли он порт и что считать его «здоровьем».
3. Образ и Secret зафиксированы только по задаче. Ingress без аннотаций: лимиты тела запроса и таймауты nginx не заданы.
