# REPORT: vendor/libescape.so

## Ответ

Дизассемблирование на этой машине возможно: файл — ELF64 x86-64, штатный `objdump` 2.42 разбирает его нативно (кросс-архитектурный objdump не нужен). Файл не запускался, только статический анализ.

Экспортируемых функций три (`nm -D --defined-only`): `_init`, `_fini`, `PyInit__speedups`. Прикладная — одна, первая по смыслу: `PyInit__speedups` (0x1cf0, 0x62 байта). Это точка входа расширения CPython (модуль `_speedups`). По инструкциям она:

1. `lea rdi,[rip+0x46d]` → строка по 0x2165 = `"markupsafe"`; `call PyImport_ImportModule`. При NULL (`test rax,rax; je 1d40`) возвращает 0 (`xor eax,eax; ret`).
2. `lea rsi,[rip+0x467]` → строка по 0x2170 = `"Markup"`; `call PyObject_GetAttrString(module, "Markup")`; результат пишет в глобал `markup` (0x41b0).
3. Уменьшает refcount модуля (`sub rax,1` по `[rbp]`, при нуле — `_Py_Dealloc`).
4. Хвостовой вызов `PyModule_Create2(&module_definition /*0x40a0*/, 0x3f5)` (0x3f5 = 1013 = PYTHON_API_VERSION) и возврат созданного модуля.

То есть: импортирует `markupsafe.Markup`, сохраняет его и создаёт модуль `_speedups`. Это похоже на C-ускоритель `markupsafe._speedups` (в `.rodata` есть `escape_silent`, «the escaped text», `Markup('')`). Сетевых/файловых/exec-вызовов в этой функции нет. Импорты из libc — только `memcpy` и `__cxa_finalize`; остальное — Python C API.

Границы вывода: разобрана только `PyInit__speedups`. Функции `escape`, `escape_silent`, `soft_str` и др. не экспортируются, а регистрируются через таблицу методов в `module_definition`; их тела я не разбирал, поэтому «вся библиотека безопасна» из этого не следует. Совпадение с настоящим markupsafe — по строкам, не по сверке с эталоном.

## Улики

```
$ readelf -h vendor/libescape.so
  Класс: ELF64   Машина: Advanced Micro Devices X86-64   Тип: DYN

$ objdump --version | head -1
GNU objdump (GNU Binutils for Ubuntu) 2.42

$ nm -D --defined-only vendor/libescape.so
0000000000001d54 T _fini
0000000000001000 T _init
0000000000001cf0 T PyInit__speedups

$ objdump -d -M intel --disassemble=PyInit__speedups vendor/libescape.so
    1cf1: lea  rdi,[rip+0x46d]   # 2165
    1cf8: call 10a0 <PyImport_ImportModule@plt>
    1d02: lea  rsi,[rip+0x467]   # 2170
    1d0f: call 1030 <PyObject_GetAttrString@plt>
    1d14: mov  QWORD PTR [rip+0x2495],rax   # 41b0 <markup>
    1d2d: mov  esi,0x3f5
    1d32: lea  rdi,[rip+0x2367]  # 40a0 <module_definition>
    1d3a: jmp  1090 <PyModule_Create2@plt>

$ objdump -s --start-address=0x2160 --stop-address=0x2190 vendor/libescape.so
 2160 ... 6d6c5f5f 006d6172 6b757073 61666500  ml__.markupsafe.
 2170 4d61726b 7570006d 61726b75 70736166      Markup.markupsaf
```

`_init` (0x1000) — стандартная: вызывает `__gmon_start__`, если он задан.

## Что предлагаю

- Не загружать `.so` в рабочий Python до закрытия вопроса: `import` исполнит `.init_array` и `PyInit__speedups`.
- Источник не передан, поэтому надёжнее всего заменить штатным пакетом `markupsafe` из доверенного индекса и сравнить SHA-256 с присланным файлом (здесь сети нет — сделать на машине с доступом).
- Если нужен именно этот файл: разобрать методы из `module_definition` (0x40a0) и `.init_array` (0x3dd8) тем же `objdump`, затем проверить поведение в изолированной песочнице без сети.
- Попросить подрядчика исходники и описание сборки.
