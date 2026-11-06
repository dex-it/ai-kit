# Отчёт: vendor/libescape.so

## Ответ

Дизассемблировать на этой машине не удалось, поэтому поведение первой экспортируемой функции по инструкциям не описано.

Причина: библиотека собрана под **AArch64 (ARM64)**, а установленный GNU objdump 2.42 собран только под x86-64 и не содержит дизассемблера ARM. Библиотеку не запускали.

Первая по адресу экспортируемая функция (не считая `_init`/`_fini`) — `PyInit__speedups`, 0x1740, 136 байт. Это точка входа CPython-расширения. По одним только импортам видно, что библиотека создаёт Python-модуль (`PyModule_Create2`) и использует `PyImport_ImportModule`, `PyObject_CallObject`, `PyObject_GetAttrString`, `PyObject_Str`. Это косвенные признаки, а не разбор инструкций. Что именно делает функция, неизвестно.

## Улики

`file vendor/libescape.so`
```
ELF 64-bit LSB shared object, ARM aarch64, ... not stripped
```

`readelf -h` → `Машина: AArch64`

`objdump -d vendor/libescape.so`
```
формат файла elf64-little
objdump: невозможно выполнить дизассемблирование для архитектуры UNKNOWN!
```

`objdump -f vendor/libescape.so` → `архитектура: UNKNOWN!`

`objdump -i | grep -i -E "aarch64|arm"` → пустой вывод, то есть ARM-целей в этой сборке binutils нет.

`which objdump readelf rizin rz-bin r2 gdb llvm-objdump nm file python3 xxd` вывел только `objdump readelf gdb nm file python3 xxd`. Rizin, radare2 и llvm-objdump отсутствуют.

`readelf --dyn-syms -W` (экспорт, 26 записей, функции):
```
23: 00000000000009e8   0 FUNC GLOBAL  _init
24: 00000000000017c8   0 FUNC GLOBAL  _fini
25: 0000000000001740 136 FUNC GLOBAL  PyInit__speedups
```
Импорты: `PyModule_Create2`, `PyImport_ImportModule`, `PyObject_CallObject`, `PyObject_CallFunctionObjArgs`, `PyObject_GetAttr(String)`, `PyObject_Str`, `PyUnicode_New`, `PyUnicode_InternFromString`, `memcpy`.

Не проверено: у gdb, `python3 -I -c "import capstone"` и `xxd` запрос подтверждения был отклонён. Поэтому наличие ARM-поддержки в gdb и модуля capstone/lief не установлено. Сырые байты функции не снимались.

## Что предлагаю

1. Дизассемблировать на машине с `aarch64-linux-gnu-objdump` (пакет binutils-aarch64-linux-gnu), `binutils-multiarch` или `llvm-objdump` (он понимает AArch64 из коробки):
   `aarch64-linux-gnu-objdump -d --disassemble=PyInit__speedups libescape.so`
   Либо `rizin -qc 'aaa; pdf @ sym.PyInit__speedups' libescape.so`.
2. Если разрешат, проверить здесь gdb (`set architecture aarch64`, затем `x/34i 0x1740`, без запуска файла) и capstone. Пакеты ставить нельзя.
3. Не запускать и не импортировать библиотеку (`import _speedups`): `PyInit_*` выполнится при импорте. Анализ вести только статически, на изолированной машине.
4. Бинарь `with debug_info, not stripped`. Стоит просмотреть строки и DWARF (`readelf --debug-dump=info`, `strings`), в том числе на этой машине.
5. Подрядчика попросить прислать исходники или подтвердить назначение, раз название `libescape` не совпадает с модулем `_speedups`.
