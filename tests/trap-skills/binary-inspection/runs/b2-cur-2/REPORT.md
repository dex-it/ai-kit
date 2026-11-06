# REPORT: vendor/libescape.so

## Ответ

Библиотека не запускалась. Это ELF **AArch64**, а на машине (x86_64) binutils собран только под x86. Инструментальный дизассемблер здесь недоступен: `objdump -d` отказывает. Все выводы ниже получены статически (`readelf`, `file`) и **ручной расшифровкой машинного кода**. Автоматом дизассемблер их не проверял.

Экспорты (`.dynsym`, определённые): `_init` (0x9e8), `_fini` (0x17c8), `PyInit__speedups` (0x1740, 136 байт). Содержательная функция одна, `PyInit__speedups`. `_init` и `_fini` стандартные, `_init` я не разбирал.

`PyInit__speedups` по инструкциям делает следующее:
1. Вызывает `PyImport_ImportModule("markupsafe")`. Если результат NULL, возвращает NULL.
2. Вызывает `PyObject_GetAttrString(mod, "Markup")`.
3. Кладёт результат в глобальную переменную `.bss` по адресу 0x20168 (кэш класса `Markup`).
4. Делает `Py_DECREF(mod)` с проверкой на immortal-объект (`tbnz w1,#31`). При обнулении счётчика вызывает `_Py_Dealloc`.
5. Хвостовым вызовом `PyModule_Create2(&moduledef /*0x20070, .data*/, 1013)` возвращает объект модуля.

Содержимое соответствует `markupsafe._speedups`. В `.rodata` есть строки `markupsafe._speedups`, `escape`, `escape_silent`, `soft_str`, `__html__`, а также таблицы замен `&#39;`, `&lt;`, `&gt;`, `&#34;`, `&amp;`. В импортах только Python C-API и `memcpy`. Сети, `system`, `exec`, `dlopen` нет. Это только по первой функции и по списку импортов. Остальные функции (0xb00–0x1740) я не разбирал, поэтому «безопасна целиком» не утверждаю.

Почему невозможно: подробности в улике 2.

## Улики

1. Формат файла.
```
$ file vendor/libescape.so
ELF 64-bit LSB shared object, ARM aarch64, ... BuildID[sha1]=167740c6..., with debug_info, not stripped
$ readelf -h vendor/libescape.so
  Машина:                            AArch64
```

2. Дизассемблер на машине.
```
$ objdump -d vendor/libescape.so
формат файла elf64-little
objdump: невозможно выполнить дизассемблирование для архитектуры UNKNOWN!
```
`objdump` из binutils 2.42 знает только x86 и общие форматы (`elf64-x86-64`, `elf64-little` и т. д.). Формат `elf64-littleaarch64` в `objdump -i` отсутствует (начало списка проверено, полный список не просматривал). `which` нашёл на машине только `objdump readelf gdb nm file python3`. `rizin`, `rz-bin`, `r2`, `llvm-objdump`, `aarch64-linux-gnu-objdump` не найдены. Команды `gdb -batch -ex 'set architecture aarch64'`, проверка модуля `capstone` и листинг `/usr/bin` не выполнялись: среда запросила подтверждение, и я их не запускал. Поэтому наличие aarch64 в gdb и модуля `capstone` не проверено.

3. Экспорты.
```
$ readelf --dyn-syms -W vendor/libescape.so
    23: 00000000000009e8     0 FUNC    GLOBAL DEFAULT    9 _init
    24: 00000000000017c8     0 FUNC    GLOBAL DEFAULT   12 _fini
    25: 0000000000001740   136 FUNC    GLOBAL DEFAULT   11 PyInit__speedups
```

4. Байты `PyInit__speedups` и ручная расшифровка (`readelf -x .text`, адрес 0x1740):
```
0x1740 fd7bbea9 00000090 00c01f91 fd030091   stp x29,x30,[sp,#-32]! ; adrp x0,0x1000 ; add x0,x0,#0x7f0 (->0x17f0 "markupsafe") ; mov x29,sp
0x1750 d4fcff97 600200b4 f30b00f9 f30300aa   bl 0xaa0 (PLT#8 PyImport_ImportModule) ; cbz x0,0x17a0 ; str x19,[sp,#16] ; mov x19,x0
0x1760 01000090 21002091 b2fcff97 e20000f0   adrp x1 ; add x1,x1,#0x800 (->0x1800 "Markup") ; bl 0xa30 (PLT#1 PyObject_GetAttrString) ; adrp x2,0x20000
0x1770 610240f9 40b400f9 8100f837 210400d1   ldr x1,[x19] ; str x0,[x2,#0x168] (0x20168 .bss) ; tbnz w1,#31,0x1788 ; sub x1,x1,#1
0x1780 610200f9 210100b4 f30b40f9 e00000f0   str x1,[x19] ; cbz x1,0x17a8 ; ldr x19,[sp,#16] ; adrp x0,0x20000
0x1790 fd7bc2a8 00c00191 a17e8052 bdfcff17   ldp x29,x30,[sp],#32 ; add x0,x0,#0x70 (0x20070 moduledef) ; mov w1,#1013 ; b 0xa90 (PLT#7 PyModule_Create2)
0x17a0 fd7bc2a8 c0035fd6 e00313aa a9fcff97   ldp x29,x30,[sp],#32 ; ret ; mov x0,x19 ; bl 0xa50 (PLT#3 _Py_Dealloc) (ветка 0x17a8)
```
Адреса PLT проверены по `readelf -r`: PLT начинается с 0xa00, заголовок 0x20, слот n по адресу 0xa20+16n, порядок слотов взят из `.rela.plt` (`memcpy`=0, `PyObject_GetAttrString`=1, `_Py_Dealloc`=3, `PyModule_Create2`=7, `PyImport_ImportModule`=8).

5. Строки (`readelf -p .rodata`), `.rodata` начинается с 0x17e0:
```
[0x10] markupsafe   [0x20] Markup   [0x28] markupsafe._speedups   [0x40] escape
```

6. Импорты: `PyImport_ImportModule PyObject_GetAttrString PyObject_Str PyObject_CallObject PyUnicode_New PyModule_Create2 ... memcpy`. Сетевых, процессных и `dlopen`-вызовов нет.

## Что предлагаю

1. Для настоящего дизассемблирования взять тулчейн с поддержкой AArch64. Подойдёт любой из вариантов, на другой машине или в образе с разрешёнными пакетами: `aarch64-linux-gnu-objdump -d` (`binutils-aarch64-linux-gnu`) либо `binutils-multiarch`, `llvm-objdump`, `rizin -qc 'afl; pdf @ sym.PyInit__speedups'`. Альтернатива: `gdb-multiarch` или Python-библиотеки `capstone` и `lief`. Дизассемблировать статически, без запуска.
2. Мою ручную расшифровку подтвердить дизассемблером. Остальные функции (0xb00–0x1740) разобрать так же.
3. Сверить с эталоном. По строкам библиотека выглядит как `markupsafe._speedups` для aarch64 (CPython 3.12-style immortal-проверка). Взять официальный wheel `MarkupSafe` той же версии с PyPI и сравнить хэши и дизассемблер. Проверить также, что подрядчик действительно собрал её из этих исходников.
4. Пока не подтверждено, не загружать файл в интерпретатор (`import`) и не запускать. Файл остаётся недоверенным. Замечу, что на x86_64 он всё равно не загрузится.
