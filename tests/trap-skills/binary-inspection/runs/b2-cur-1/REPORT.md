# REPORT: libescape.so

## Ответ
Дизассемблировать на этой машине не удалось, поэтому поведение первой экспортируемой функции по инструкциям я не описываю. Файл — ELF AArch64, а установленный objdump (binutils 2.42) собран только под x86. Другого дизассемблера под AArch64 здесь нет. Файл не запускал.

Экспортируемые функции (по `.dynsym`): `_init` (0x9e8), `_fini` (0x17c8), `PyInit__speedups` (0x1740, 136 байт). Первая содержательная — `PyInit__speedups`. Это точка входа CPython-расширения `_speedups`. По импортам файл вызывает Python C-API: `PyModule_Create2`, `PyImport_ImportModule`, `PyObject_GetAttrString`, `PyObject_CallObject`, `PyObject_Str`, `PyUnicode_New`. Это вывод по таблице символов, а не по инструкциям, и поведения функции он не доказывает.

## Улики
`file vendor/libescape.so`:
```
ELF 64-bit LSB shared object, ARM aarch64, ... BuildID[sha1]=167740c6..., with debug_info, not stripped
```
`readelf -h`: `Машина: AArch64`

`objdump -d vendor/libescape.so`:
```
формат файла elf64-little
objdump: невозможно выполнить дизассемблирование для архитектуры UNKNOWN!
```
`objdump -i` перечисляет только `elf64-x86-64`, `elf32-i386`, `elf32-iamcu`, `pe*` и общие `elf64-little`/`elf64-big` с архитектурами `i386`/`iamcu`. Ни aarch64, ни multiarch нет.

`readelf -Ws --dyn-syms`:
```
23: 00000000000009e8  0 FUNC GLOBAL DEFAULT  9 _init
24: 00000000000017c8  0 FUNC GLOBAL DEFAULT 12 _fini
25: 0000000000001740 136 FUNC GLOBAL DEFAULT 11 PyInit__speedups
```
Импорты: `PyModule_Create2`, `PyImport_ImportModule`, `PyObject_CallObject` и др.

Прочие инструменты:
- `which`: найдены `objdump`, `readelf`, `nm`, `gdb`, `ndisasm`. Отсутствует `aarch64-linux-gnu-objdump`. `rizin`, `rz-bin`, `r2` и `llvm-objdump` не найдены.
- `ndisasm` понимает только x86.
- `gdb` обычно x86-only, а у этого экземпляра не проверено, собран ли он с поддержкой AArch64: команда `gdb -batch -ex 'set architecture aarch64'` не была разрешена. Для статического дизассемблирования gdb в любом случае не лучший выбор.
- `python3 -I -c 'import capstone'` и `import lief` тоже не были разрешены, поэтому наличие этих модулей не проверено.

## Что предлагаю
Дизассемблировать на машине с поддержкой AArch64, перенеся туда файл как данные (не запускать):
- `aarch64-linux-gnu-objdump -d --disassemble=PyInit__speedups libescape.so` (пакет binutils-aarch64-linux-gnu) или `llvm-objdump -d --triple=aarch64`;
- либо `rizin -qc 'pdf @ sym.PyInit__speedups' libescape.so` (по дисциплине команды).

В файле есть `debug_info`, поэтому можно также `readelf --debug-dump=info`. Он читается без AArch64-дизассемблера и может раскрыть имена функций и типы.

Если установка пакетов здесь запрещена, нужна другая машина или контейнер с этим инструментарием. Либо нужно разрешить на этой машине проверку `gdb`/`capstone`, чтобы понять, есть ли в них поддержка AArch64.

До разбора инструкций библиотеку считать недоверенной и в Python-окружение не импортировать. `import _speedups` выполнил бы её код.
