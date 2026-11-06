# Отчёт: vendor/libescape.so

## Ответ
Дизассемблирование на этой машине возможно: файл — ELF64 x86-64 (e_machine 0x3e), системный `objdump` 2.42 (elf64-x86-64) его разбирает. Библиотека не запускалась, только статический разбор.

Экспортируемых функций три (`nm -D --defined-only`): `_init` (0x1000), `PyInit__speedups` (0x1cf0, 98 байт), `_fini` (0x1d54). `_init` и `_fini` — стандартные заглушки. Содержательная функция одна: `PyInit__speedups`. Если «первая» означает младший адрес, то это `_init`.

**`_init` (0x1000)**: загружает слот GOT `__gmon_start__`. Если он не NULL, вызывает его через PLT. Затем `ret`. Это стандартный пролог для gprof/CRT, ничего своего.

**`PyInit__speedups` (0x1cf0)** по инструкциям:
1. `lea rdi,[rip+0x46d]` (→ .rodata 0x2165, строка `"markupsafe"`) и `call PyImport_ImportModule`.
2. `test rax,rax; je 1d40`: при ошибке импорта возвращает NULL (`xor eax,eax; ret`).
3. Иначе вызывает `PyObject_GetAttrString(module, "Markup")` (строка с 0x2170). Результат кладёт в глобальную переменную `markup` (0x41b0).
4. Снимает ссылку с модуля: уменьшает refcount `[rbp]` и при нуле зовёт `_Py_Dealloc`.
5. `PyModule_Create2(&module_definition, 0x3f5)` (0x3f5 = 1013, `PYTHON_API_VERSION`) через tail-call `jmp`. Возвращает объект модуля `_speedups`.

Итог: это инициализатор расширения CPython `_speedups`. Он кэширует `markupsafe.Markup` и создаёт модуль.

Остальное содержимое библиотеки (локальные функции `soft_str`, `escape`, `escape_silent`, `escape_unicode`) выглядит как копия C-ускорителя `markupsafe._speedups`. Это подтверждают docstring'и и литералы `&#34;`, `&#39;`, `&lt;`, `&gt;` в .rodata, а также импорты `PyUnicode_New`, `PyObject_Str`, `memcpy`. Эти функции я не дизассемблировал и не разбирал: вывод о назначении основан на строках и импортах, а не на инструкциях.

## Улики
```
$ head -c 20 libescape.so | od -An -tx1
 7f 45 4c 46 02 01 01 00 ... / 03 00 3e 00      # ELF64, ET_DYN, EM_X86_64

$ objdump -i | head
BFD header file version (GNU Binutils for Ubuntu) 2.42
elf64-x86-64

$ nm -D --defined-only libescape.so
0000000000001d54 T _fini
0000000000001000 T _init
0000000000001cf0 T PyInit__speedups

$ objdump -d -M intel --start-address=0x1cf0 --stop-address=0x1d52 -j .text libescape.so
    1cf1: lea rdi,[rip+0x46d]   # 2165
    1cf8: call 10a0 <PyImport_ImportModule@plt>
    1d0f: call 1030 <PyObject_GetAttrString@plt>
    1d14: mov QWORD PTR [rip+0x2495],rax   # 41b0 <markup>
    1d2d: mov esi,0x3f5
    1d32: lea rdi,[rip+0x2367]  # 40a0 <module_definition>
    1d3a: jmp 1090 <PyModule_Create2@plt>

$ readelf -p .rodata libescape.so
  [165] markupsafe
  [170] Markup
  [177] markupsafe._speedups
```
Ограничение: в `objdump -d` для `_init` вывод получен через `--start-address`. Ключ `--disassemble=` с несколькими символами показал только `_fini`.

## Что предлагаю
- Файл выглядит как ускоритель MarkupSafe, но подтверждено это только на уровне `PyInit` и строк. Подрядчика нужно спросить, из какой версии и из какого источника он собран.
- Чтобы сверить остальное, нужно взять официальный `markupsafe` и сравнить `_speedups`. Для проверки модификаций можно использовать побайтовое сравнение или сравнение дизассемблирования `escape*`. На этой машине без сети это невозможно.
- Лучше заменить файл официальной сборкой из PyPI. Если замена невозможна, нужен разбор `escape_unicode`, `escape` и `escape_silent` с поиском лишних импортов или вызовов. Для интерактивного анализа подойдёт Rizin (его здесь нет) или `gdb` (есть, но только на неисполняемом файле).
- Не загружать библиотеку в продуктивный Python, пока не проведена сверка.
