# REPORT: vendor/libescape.so

## Ответ
Дизассемблировать на этой машине можно: есть binutils `objdump`/`readelf`/`nm` (x86-64 ELF, ISA совпадает с хостом). Файл не запускался и не загружался, только статический разбор.

Экспортируемые функции (`nm -D --defined-only`): `PyInit__speedups` (0x1cf0), а также служебные `_init` (0x1000) и `_fini` (0x1d54). Первая по адресу: `_init`, стандартная заглушка (вызывает `__gmon_start__`, если он есть). Первая содержательная: `PyInit__speedups`.

`PyInit__speedups` по инструкциям — это инициализатор CPython-расширения:
1. `lea rdi,[rip+0x46d]` (0x2165, строка `"markupsafe"`), `call PyImport_ImportModule`. Импортируется модуль `markupsafe`.
2. `test rax,rax; je 1d40`. Если импорт не удался, возвращает NULL (`xor eax,eax; ret`).
3. `lea rsi,[rip+0x467]` (0x2170, строка `"Markup"`), `call PyObject_GetAttrString`. Берётся `markupsafe.Markup`.
4. `mov [rip+0x2495],rax` (глобал `markup` @ 0x41b0). Результат сохраняется в глобальную переменную.
5. Блок `mov rax,[rbp]; ... sub rax,1; mov [rbp],rax; je -> _Py_Dealloc` — это `Py_DECREF` модуля markupsafe.
6. `mov esi,0x3f5` (1013 = PYTHON_API_VERSION), `lea rdi,[module_definition]`, `jmp PyModule_Create2`. Создаёт и возвращает модуль `_speedups`.

Вывод: по виду это собранный вариант `markupsafe._speedups` (C-ускоритель экранирования). Импорты: только API CPython (`PyUnicode_New`, `PyObject_Str`, `PyObject_CallFunctionObjArgs` и др.) и `memcpy`. Сети, файлов, `system`/`exec` в списке импортов нет. Это вывод только по таблице импортов и первой функции. Остальной код (экранирование) я не разбирал, поэтому безопасность библиотеки целиком он не доказывает.

## Улики
`nm -D --defined-only vendor/libescape.so`:
```
0000000000001d54 T _fini
0000000000001000 T _init
0000000000001cf0 T PyInit__speedups
```
`objdump -d -M intel --no-show-raw-insn --disassemble=PyInit__speedups vendor/libescape.so`:
```
1cf1: lea  rdi,[rip+0x46d]   # 2165
1cf8: call 10a0 <PyImport_ImportModule@plt>
1d02: lea  rsi,[rip+0x467]   # 2170
1d0f: call 1030 <PyObject_GetAttrString@plt>
1d14: mov  QWORD PTR [rip+0x2495],rax   # 41b0 <markup>
1d2d: mov  esi,0x3f5
1d32: lea  rdi,[rip+0x2367]  # 40a0 <module_definition>
1d3a: jmp  1090 <PyModule_Create2@plt>
```
`objdump -s --start-address=0x2160 --stop-address=0x2190 vendor/libescape.so` (.rodata):
```
2160 6d6c5f5f 006d6172 6b757073 61666500  ml__.markupsafe.
2170 4d61726b 7570006d 61726b75 70736166  Markup.markupsaf
2180 652e5f73 70656564 75707300 ...       e._speedups.
```
`file`: ELF 64-bit x86-64, not stripped, with debug_info.

## Что предлагаю
- Сравнить с официальным `markupsafe/_speedups*.so` той же версии (хэш, `objdump -d` diff). Источник — PyPI-колесо.
- Дизассемблировать остальной `.text` (функции `escape`, `soft_str` и т. п. — они static, символов в экспорте нет) и сверить список импортов с эталоном. Сейчас импорты выглядят нормальными.
- Если подрядчик не обязан поставлять бинарь, взять `markupsafe` из PyPI и не принимать присланный `.so`.
- Файл не загружать (`import`/`dlopen`) до сверки: инициализатор выполняет код при загрузке.
- Rizin/LIEF на машине нет (ставить нельзя); для разбора крупнее достаточно binutils и `gdb` (без запуска).
