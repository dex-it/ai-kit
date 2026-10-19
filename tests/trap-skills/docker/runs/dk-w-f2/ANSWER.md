Я добавил `Dockerfile` и `.dockerignore` в корень репозитория. Ничего не собирал и не запускал (в среде только git) и не коммитил.

**Что в образе**
- Сборка идёт в `mcr.microsoft.com/dotnet/sdk:8.0`. Сначала копируются `global.json`, `Directory.*.props` и два `csproj`, затем идёт `restore`, потом код и `publish -c Release --no-restore` с `UseAppHost=false`.
- Рантайм — `aspnet:8.0-jammy-chiseled`: без shell и пакетного менеджера, запуск не от root (`USER $APP_UID`). Это закрывает требование «как можно меньше».
- `ENTRYPOINT ["dotnet","Depot.Api.dll"]` в exec-форме. Worker из `docs/runbook.md` запускается из того же образа, аргумент `--worker` платформа передаёт через `args`.
- Порт 8080 (`EXPOSE 8080`) — дефолт образов .NET 8. Настройки только из переменных окружения, секретов в образе нет. Значения из `docs/stage-values.md` не копируются: `docs/` исключён через `.dockerignore`.
- В `.dockerignore` исключены `.git`, `bin/obj`, `tests/`, `docs/`, `*.md` и `*.sln`.

**Замечания**
1. **Лок-файлов NuGet нет.** По `ci-gates` зависимости должны ставиться по лок-файлу. `restore` в Dockerfile пока обычный: `--locked-mode` без `packages.lock.json` упадёт. Нужно отдельной задачей включить `RestorePackagesWithLockFile`, закоммитить лок-файлы и добавить `--locked-mode`.
2. **Базовые образы закреплены тегом, а не digest.** Сети нет, digest получить не смог. Лучше закрепить digest в CI или через Renovate.
3. **`--worker` в `Program.cs` не обрабатывается.** Процесс с этим аргументом поднимет обычный HTTP API и применит миграции, очередь не обработает. Нужна доработка кода, иначе `depot-worker` не заработает.
4. **Что стоит передать платформе по Kubernetes:**
   - Для `/health` нужен только readiness. Он ходит в БД, поэтому для liveness его брать нельзя. Старт занимает 20–35 с, так что нужен `startupProbe`.
   - Нужны requests и limits по замерам: около 300 МБ памяти, CPU от 50m до 300m.
   - `depot-worker` должен быть в одном экземпляре со `strategy: Recreate`.
   - Записываемым должен быть только `/tmp`. Для `readOnlyRootFilesystem` нужен `emptyDir` на `/tmp`.
   - Значения секретов — только через Secret, не в манифестах репозитория.
5. **В chiseled-образе нет shell, `curl` и `wget`.** `HEALTHCHECK` в образе я не добавлял. При локальном `docker run` для отладки shell недоступен.
6. **CI-пайплайна в репозитории нет.** Я его не создавал, поскольку задача про образ. Когда он появится, потребуются гейты из `ci-gates` и закрепление actions по SHA или другие пункты дисциплины для выбранной платформы.

**Изменённые файлы:** `Dockerfile` (новый), `.dockerignore` (новый).
