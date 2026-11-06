# REPORT: vendor/libescape.so

## Ответ
Дизассемблировать можно: ELF64 x86-64, на машине есть GNU objdump 2.42 (rizin/radare2 нет, они не нужны). Файл не запускался, только статический разбор.

Экспортируется одна прикладная функция: `PyInit__speedups` (0x1cf0). `_init` и `_fini` служебные. Это точка входа CPython-расширения `_speedups`. По инструкциям она делает следующее:

1. `PyImport_ImportModule("markupsafe")` (строка по 0x2165). При NULL возвращает 0 (`xor eax,eax; ret`), то есть импорт не удался.
2. `PyObject_GetAttrString(mod, "Markup")` (строка по 0x2170). Результат кладётся в глобальную `markup` (0x41b0).
3. Уменьшает refcount модуля, при нуле вызывает `_Py_Dealloc`.
4. Хвостовым переходом вызывает `PyModule_Create2(&module_definition /*0x40a0*/, 0x3f5 /*PYTHON_API_VERSION 1013*/)` и возвращает объект модуля.

Остальные функции (escape, escape_silent, soft_str) не экспортируются. Их имена и docstring есть в .rodata, но разбирал я только первую функцию, как просили. По форме (docstring, таблицы замен `&#34; &#39; &amp; &lt; &gt;`, имена `escape`/`escape_silent`/`soft_str`) это похоже на C-ускоритель MarkupSafe. Это вывод по строкам, а не доказательство. Побайтовое равенство с официальной сборкой не проверялось.

## Улики
`readelf -h libescape.so`:
```
Класс: ELF64   Машина: Advanced Micro Devices X86-64   Тип: DYN
```
`nm -D libescape.so` (экспорт):
```
0000000000001cf0 T PyInit__speedups
0000000000001d54 T _fini
0000000000001000 T _init
```
Импорты: только libc `memcpy` и API CPython (`PyUnicode_New`, `PyObject_Str`, `PyObject_CallFunctionObjArgs` и т. п.). Сетевых и процессных функций (`system`, `exec*`, `dlopen`, `socket`) в таблице импортов нет.

`objdump -d -M intel --no-show-raw-insn --disassemble=PyInit__speedups libescape.so`:
```
1cf1: lea  rdi,[rip+0x46d]   # 2165  -> "markupsafe"
1cf8: call PyImport_ImportModule@plt
1d00: je   1d40              # NULL -> return 0
1d02: lea  rsi,[rip+0x467]   # 2170  -> "Markup"
1d0f: call PyObject_GetAttrString@plt
1d14: mov  QWORD PTR [rip+0x2495],rax   # markup
1d2d: mov  esi,0x3f5
1d32: lea  rdi,[rip+0x2367]  # module_definition
1d3a: jmp  PyModule_Create2@plt
```
`objdump -s -j .rodata` по смещению 0x2160: `__html__.markupsafe.Markup.markupsafe._speedups.escape.escape_silent.soft_str`.

## Что предлагаю
- Не считать файл проверенным: разобрана только `PyInit__speedups`. Тела `escape`, `escape_silent` и `soft_str` не читались.
- Сверить SHA-256 с официальным колесом MarkupSafe нужной версии (когда будет доступ к сети, на другой машине). Либо запросить у подрядчика исходники и способ сборки.
- До сверки грузить только в изолированном окружении без сети.
- Для глубокого разбора остальных функций нужны rizin, Ghidra или IDA. Здесь они не установлены, а ставить пакеты нельзя. Через `objdump` это тоже возможно, например разбор по `--start-address`.
