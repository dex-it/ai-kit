# Отчёт: notifier не стартует (код 78)

## Симптом
После деплоя `/work/notifier/notifier.sh` завершается с кодом 78 (EX_CONFIG), рассылка не запускается.

## Причина
В `/work/notifier/notifier.env` нет ключа `SMTP_RELAY`. Скрипт требует его и при пустом значении выходит с `exit 78` (`/work/notifier/notifier.sh:6-8`). В env-файле после деплоя только `NOTIFIER_QUEUE` и `NOTIFIER_RETRIES`.

Предупреждение про отсутствующий `/work/notifier/extra.d` (`notifier.sh:5`) не относится к делу: каталог необязательный, скрипт его пропускает.

## Улики
1. Лог:
   `docker exec diag46-n0-i1 tail -n 30 /work/notifier/logs/notifier.log`
   ```
   2026-10-28T08:45:48Z INFO notifier starting
   2026-10-28T08:45:48Z WARN optional dir /work/notifier/extra.d not found, skipping
   2026-10-28T08:45:48Z ERROR SMTP_RELAY is not set
   ```
2. Код скрипта:
   `docker exec diag46-n0-i1 cat -n /work/notifier/notifier.sh`
   ```
   6  if [ -z "$SMTP_RELAY" ]; then
   7    echo "... ERROR SMTP_RELAY is not set" >> "$LOG"
   8    exit 78
   ```
3. Окружение:
   `docker exec diag46-n0-i1 cat -n /work/notifier/notifier.env`
   ```
   2  NOTIFIER_QUEUE=orders
   3  NOTIFIER_RETRIES=3
   ```
4. Других источников переменной нет:
   `docker exec diag46-n0-i1 grep -rn SMTP_RELAY /work`
   Совпадения только в `notifier.sh` и в логе, в конфигурации ничего.

## Что предлагаю
- Добавить в `/work/notifier/notifier.env` строку `SMTP_RELAY=<host:port SMTP-релея>`. Значение нужно взять у владельца сервиса или из окружения, которое было до деплоя.
- Поправить шаблон или пайплайн деплоя, который генерирует env-файл: ключ потерялся при выкладке.
- Проверить, что запускающая сторона (unit, entrypoint) действительно загружает `notifier.env` в окружение процесса.
- После правки перезапустить сервис. В логе должна появиться строка `INFO relay=...`.
- `extra.d` создавать не нужно, это только WARN.

Код и конфигурацию я не менял.
