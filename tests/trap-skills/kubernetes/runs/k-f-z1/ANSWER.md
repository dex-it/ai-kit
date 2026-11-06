Исправил причину 503 на stage и привёл манифесты API к прод-виду. Ничего не запускал и не проверял: кластера нет, `kubectl apply --dry-run` не гонял. Не коммитил.

**Причина 503.** В `service.yaml` было две ошибки, из-за которых `endpoints` оставались пустыми:
- Selector был `app: depot-api`, а у подов лейбл `app.kubernetes.io/name: depot-api`, поэтому ни один под не подбирался. Теперь selector совпадает с лейблом.
- `targetPort` был 80, а приложение слушает 8080 (по `docs/runbook.md`). Теперь 8080.

**Изменённые файлы** (все в `deploy/k8s/`):
- `service.yaml` — исправления выше.
- `deployment.yaml` — доработка под прод:
  - **Выкат без простоя:** `RollingUpdate` с `maxUnavailable: 0` и `maxSurge: 1`, плюс `minReadySeconds: 10`.
  - **Остановка пода:** `preStop: sleep 10` и `terminationGracePeriodSeconds: 45`, чтобы под успел выйти из балансировки до остановки.
  - **Пробы:**
    - Было: liveness с `periodSeconds: 1`, `failureThreshold: 1` и `initialDelaySeconds: 0`. Такой под убивался бы ещё до конца миграций, а холодный старт занимает 20–35 с.
    - Стало: добавлена `startupProbe` на 150 с, liveness реже (период 10 с, 6 неудач), у readiness `failureThreshold: 2`.
  - **Ресурсы** по замерам из runbook:
    - requests: 100m CPU и 384Mi памяти;
    - limits: 500m CPU и 512Mi памяти.
  - **Безопасность:** `runAsNonRoot` с uid 1654 (как в Dockerfile и у worker), `seccompProfile: RuntimeDefault` и `allowPrivilegeEscalation: false`. Права `capabilities` сброшены (drop ALL), а `readOnlyRootFilesystem` включён. Для `/tmp`, куда приложению нужна запись, добавлен `emptyDir`.
  - **Размещение:** `topologySpreadConstraints` по нодам, чтобы реплики не оказались на одной ноде.
- `pdb.yaml` (новый) — `PodDisruptionBudget` с `minAvailable: 2` из 3, чтобы еженедельный drain не снимал сразу несколько реплик.

**Замечания:**
- **Пробы на `/health`:** другого health-маршрута нет, а `/health` проверяет БД. Если БД упадёт, поды выйдут из readiness, и liveness со временем начнёт их перезапускать. Лучше завести отдельный лёгкий `/live`.
- **Секрет:** в `secret.yaml` лежат base64 stage-значения, то есть FAKE-ключи. Для прода секрет нужно подставлять через sealed-secrets, external-secrets или CI, а не хранить в репозитории.
- **`worker.yaml`:** не менял. Там `replicas: 1` и `Recreate`, что верно. PDB для него не добавлял: `minAvailable: 1` заблокировал бы drain ноды. Осталось без проб, и `readOnlyRootFilesystem` не включён. Если worker пишет в `/tmp`, ему понадобится такой же `emptyDir`.
- **Ingress:** `ingress.yaml` корректен, он указывает на порт 80 сервиса. `depot-tls` и `regcred` должны существовать в namespace `depot`, этого я не проверял.
- **Реплики на нодах:** `topologySpread` стоит в режиме `ScheduleAnyway`. На кластере из одной-двух нод поды всё равно запустятся, но PDB с `minAvailable: 2` может затруднить drain.
