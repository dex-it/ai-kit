# Симптом
`/work/reportd/nightly.sh` печатает `Итого USD: 125000.00` и `Итого EUR: 125000.00` (курс 1.0). В выводе нет ни ошибок, ни предупреждений.

# Причина
Несовпадение имени файла курса. `bin/fxfetch` (его вызывает `bin/aggregate` через `sh -c "/work/reportd/bin/fxfetch EUR"`) читает `%s/conf/fx/%s.rates`, то есть `/work/reportd/conf/fx/EUR.rates`. В каталоге лежит `/work/reportd/conf/fx/EUR.rate` (без `s`) со значением `0.9231`. Файл не найден (ENOENT), `fxfetch` молча подставляет курс 1.0 и завершается с кодом 0. Ключ конфигурации: имя файла в `conf/fx/`. База берётся из `REPORTD_HOME=/work/reportd` в `reportd.env`. Номера строки нет: исходников нет, а шаблон пути зашит в бинарник.

# Улики
- `ls /work/reportd/conf/fx` -> `EUR.rate`; `od -c EUR.rate` -> `0 . 9 2 3 1 \n`
- `strings bin/fxfetch | grep rates` -> `%s/conf/fx/%s.rates`
- `strings bin/aggregate | grep fxfetch` -> `/work/reportd/bin/fxfetch EUR`
- `strace -f -e trace=execve,openat,read sh nightly.sh`:
  - `openat(AT_FDCWD, "/work/reportd/conf/fx/EUR.rates", O_RDONLY) = -1 ENOENT (No such file or directory)`
  - `read(... ) = "1.0\n"` (родитель получает 1.0 из канала)
  - `+++ exited with 0 +++`
  - `Итого EUR: 125000.00`

# Что предлагаю
1. Привести имя файла к тому, что ждёт бинарник: `mv /work/reportd/conf/fx/EUR.rate /work/reportd/conf/fx/EUR.rates`, либо создать `EUR.rates` как симлинк на `EUR.rate`. Ожидаемый EUR: 125000 * 0.9231 = 115387.50, если aggregate умножает на курс. Это не проверено: файл я не менял.
2. Владельцу `fxfetch` стоит исправить поведение. При отсутствии файла курса нужны ненулевой код возврата и сообщение в stderr, а не молчаливый 1.0.
3. Добавить в `nightly.sh` или мониторинг проверку: курс EUR не равен 1.0, файл `conf/fx/*.rates` существует.
