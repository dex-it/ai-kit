Манифесты написаны, ничего не коммитил. Применить их или проверить на кластере я не мог: там только git.

**Новые файлы в `deploy/k8s/`:**
- `00-namespace.yaml` — namespace `depot`.
- `10-secret.yaml` — Secret `depot-env` со значениями для stage из `docs/stage-values.md`.
- `20-api.yaml` — Deployment `depot-api`, PodDisruptionBudget, Service и Ingress.
- `30-worker.yaml` — Deployment `depot-worker`.

**Что сделано:**
- **API:** 3 реплики, образ `registry.example.com/depot/api:1.4.0`, pull-secret `regcred`, порт 8080.
- **Выкат без простоя:** RollingUpdate с `maxUnavailable: 0` и `maxSurge: 1`. Перед остановкой пода стоит `preStop sleep 10`, под нодами работает PDB с `maxUnavailable: 1`, поды распределяются по нодам.
- **Пробы:**
  - Startup-проба на `/health` ждёт до 150 с, холодный старт занимает 20–35 с.
  - Readiness-проба тоже на `/health`.
  - Liveness-проба — TCP на порт 8080. `/health` зависит от БД, и при сбое БД liveness по нему перезапустила бы все поды сразу.
- **Ingress:** класс `nginx`, хост `depot.example.com`, TLS-secret `depot-tls`.
- **Безопасность и ресурсы:**
  - Поды запускаются от пользователя 1654 без root, с read-only корневой ФС и `emptyDir` на `/tmp`.
  - Ресурсы: request 100m CPU и 384Mi памяти, limit 500m CPU и 512Mi памяти.
- **Worker:** тот же образ с `args: ["--worker"]`, ровно 1 реплика, стратегия `Recreate`, чтобы при выкате не работали два экземпляра. PDB для него нет: при одной реплике он блокировал бы drain нод.

**Замечания:**
1. Secret в git содержит тестовые stage-значения. Это нужно, чтобы `kubectl apply -f deploy/k8s/` работал как есть. Для прода Secret `depot-env` надо создавать отдельно, вне репозитория, иначе применение этих манифестов подставит stage-значения.
2. Прод и stage описаны одним набором манифестов. Для stage 3 реплики и `pg-stage` в Secret могут быть избыточны, и разделение на overlays я не делал, потому что в задаче его нет.
3. В runbook ничего не сказано о портах и пробах worker. Поэтому проб у него нет, и сбой worker k8s не заметит, пока процесс жив.
4. `preStop` использует `sleep` из образа `aspnet:8.0.11` (Debian). Если перейти на chiseled-образ, `sleep` в нём не будет, и `preStop` придётся заменить.
5. Миграции выполняются при старте каждого пода, и API и worker запускаются одновременно. Безопасность параллельных миграций в `Migrator.cs` я не проверял.
