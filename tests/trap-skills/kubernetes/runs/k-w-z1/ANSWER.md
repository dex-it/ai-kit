Манифесты лежат в `deploy/k8s/`, ничего не закоммичено. Я их не применял и не проверял: кластера и `kubectl` нет.

**Новые файлы:**
- `00-namespace.yaml`: namespace `depot`.
- `10-secret.yaml`: Secret `depot-env` с двумя настройками из `docs/stage-values.md`. Значения там тестовые (FAKE).
- `20-api-deployment.yaml`: API, 3 реплики, образ `registry.example.com/depot/api:1.4.0`, pull-secret `regcred`.
- `21-api-service.yaml`: Service на порту 80, внутри пода 8080.
- `22-api-pdb.yaml`: PodDisruptionBudget `minAvailable: 2`.
- `23-api-ingress.yaml`: Ingress класса nginx, хост `depot.example.com`, TLS-secret `depot-tls`.
- `30-worker-deployment.yaml`: `depot-worker`, ровно 1 реплика.

**Как устроено:**
- **Выкат без простоя:** у API `maxUnavailable: 0` и `maxSurge: 1`. PodDisruptionBudget защищает от еженедельного drain нод. Поды разносятся по нодам мягким spread-ограничением.
- **Пробы API:**
  - `startupProbe` на `/health` даёт до 150 с на старт, потому что миграции идут до 35 с.
  - `readinessProbe` тоже смотрит на `/health`.
  - `livenessProbe` — по TCP, без обращения к БД. Если проверять `/health`, при сбое БД перезапустились бы все поды сразу.
- **Worker:** стратегия `Recreate`, чтобы при выкате не работали два экземпляра. PodDisruptionBudget для него не делал: при одной реплике он заблокировал бы drain. Проб у worker нет, потому что в runbook для него health-маршрута нет.
- **Безопасность и ресурсы:**
  - Поды запускаются под uid 1654 без root.
  - Корневая ФС только для чтения, `/tmp` — `emptyDir`.
  - Запросы ресурсов: 100m CPU и 384Mi памяти. Лимит памяти — 512Mi, лимита CPU нет.

**Замечания:**
1. **`--worker` не реализован.** В `src/Depot.Api/Program.cs` аргумент `--worker` не обрабатывается. Worker запустится как обычный API (с миграциями и HTTP) и очередь обрабатывать не будет. До выкладки это нужно подтвердить с разработчиками.
2. **Секрет с тестовыми значениями.** Требование «`kubectl apply -f deploy/k8s/` как есть» вынудило положить `Secret` в репозиторий. Значения там FAKE, для stage это допустимо. Для прода их надо подставлять при деплое, а не коммитить реальные.
3. **Миграции при параллельном старте.** API и worker применяют миграции при каждом старте, поэтому при выкате возможна гонка. Нужно проверить, что `Migrator` защищён advisory-локом.
4. **Нет `Dockerfile`-`HEALTHCHECK`, метрик и NetworkPolicy.** В задаче этого не было, добавлять не стал.
