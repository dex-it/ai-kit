# REPORT: дизассемблирование vendor/libescape.so

## Ответ

Дизассемблировать на этой машине не удалось, поэтому описания функции по инструкциям нет. Библиотека собрана под **AArch64 (ARM64)**, а `objdump` здесь собран только под x86 (binutils 2.42, без multiarch). Другого дизассемблера для ARM64 на машине не нашлось.

Экспортируемая функция из `.dynsym`, не считая служебных `_init` и `_fini`, одна: `PyInit__speedups`, адрес 0x1740, размер 136 байт, то есть 34 инструкции. Судя по имени, это точка входа расширения CPython (модуль `_speedups`). Что она делает на самом деле, не проверено. Это предположение по имени, а не вывод из кода. Библиотека называется `libescape`, и расхождение имени файла с именем модуля стоит отдельно спросить у подрядчика.

Я не стал разбирать 136 байт вручную. Результат был бы непроверяемым, и выдавать его за дизассемблирование нельзя.

## Улики

`file vendor/libescape.so`:
```
ELF 64-bit LSB shared object, ARM aarch64, ... BuildID[sha1]=167740c6e1d0c4fc4dd8d2e7c8b9ca6a6fd2879c, with debug_info, not stripped
```

`readelf -h`: `Машина: AArch64`, точка входа 0xb00.

`readelf -sW --dyn-syms`, определённые символы:
```
23: 00000000000009e8     0 FUNC GLOBAL DEFAULT  9 _init
24: 00000000000017c8     0 FUNC GLOBAL DEFAULT 12 _fini
25: 0000000000001740   136 FUNC GLOBAL DEFAULT 11 PyInit__speedups
```

`objdump -i | grep -i -c -E "aarch64|arm"` вернул `0`. Первые поддерживаемые форматы: `elf64-x86-64`, `elf32-i386`.

`objdump -d --start-address=0x1740 --stop-address=0x17c8 vendor/libescape.so`:
```
vendor/libescape.so:     формат файла elf64-little
objdump: невозможно выполнить дизассемблирование для архитектуры UNKNOWN!
```
Формат прочитан, но ISA не определена, потому что нужного бэкенда нет.

`which rizin rz-bin llvm-objdump aarch64-linux-gnu-objdump gdb-multiarch r2` не нашёл ни одного из них (код возврата 1). Установка пакетов запрещена. Это соответствует предупреждению в дисциплине (`binary-inspection.md`, раздел «objdump для cross-arch»): `--target` ISA не выбирает.

Не проверено:
- `gdb` есть в системе, но поддержку aarch64 в нём я не проверял. Запуск `gdb` и проверку `import capstone` система потребовала подтвердить, и я их не запускал.
- Для недоверенного файла `gdb` без необходимости лучше не использовать.

## Что предлагаю

1. Дизассемблировать на машине с инструментом под ARM64, статически, без запуска файла:
   - `aarch64-linux-gnu-objdump -d --start-address=0x1740 --stop-address=0x17c8 libescape.so` (пакет binutils-aarch64-linux-gnu) или `binutils-multiarch`;
   - либо `rizin -qc 'aaa; pdf @ sym.PyInit__speedups' libescape.so`;
   - либо `llvm-objdump -d --triple=aarch64`.
2. Скопировать файл туда как недоверенные данные. Хэш для сверки: `sha256sum libescape.so`, BuildID указан выше.
3. Альтернатива на этой же машине: с разрешения владельца проверить, умеет ли `gdb` aarch64 (`set architecture aarch64`, затем `x/34i 0x1740`). Файл при этом не запускается. Или проверить, есть ли `capstone` в Python.
4. После дизассемблирования пересмотреть вывод про `PyInit__speedups`. Отдельно посмотреть `.init_array` и `.rela.plt` (импорты), поскольку конструкторы выполняются при загрузке библиотеки.
5. Не загружать библиотеку (`dlopen`, `import`), пока разбор не закончен.
