# Отчёт: анализ /work/vendor (недоверенные файлы)

Метод: только статический анализ (file, readelf, nm, objdump, ilspycmd). Ни один файл подрядчика не запускался.

## Симптом
Подрядчик передал без исходников libcalc.so, vendor-tool и Legacy.Pricing.dll. Нужно понять, что они содержат и делают.

## Ответы

### (1) libcalc.so
- ELF 64-bit, ARM aarch64, stripped, BuildID 81b02408108577763b392b52ddc0b3c722e134fb.
- Экспортируемые C++-функции (после c++filt):
  - `tariff::Calculator::version()`
  - `tariff::Calculator::surcharge(int, std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char>> const&) const`
  - `calc_api_level` (имя без манглинга, т.е. C-символ)
- Зависимости (NEEDED): только `libstdc++.so.6`. SONAME, RPATH и RUNPATH нет.

### (2) vendor-tool
- ELF 64-bit, **x86-64** (Machine: AMD X86-64), статически слинкован, stripped. Лаборатория aarch64, так что без эмуляции он здесь не запустится.
- Код: два syscall'а. `write(1, 0x402000, 26)`, затем `exit(0)`.
- Печатает на stdout (из .rodata): `vendor-tool 2.1 build 884` и перевод строки.

### (3) Legacy.Pricing.Discounts.Apply(decimal amount, string tier)
Сборка .NET 8 (PE32 DLL, Release). Логика по декомпиляции:
1. Читает переменную окружения `PRICING_TIER_OVERRIDE`. Если она равна `ignore-tier`, возвращает `amount` без скидки.
2. Иначе, если `tier == "gold"`, возвращает `amount * 0.8550m` (скидка 14,5%).
3. Иначе возвращает `amount * 0.9275m` (скидка 7,25%).
- Константа `LoyaltyRate = 0.0725m` в Apply напрямую не используется. Её значение зашито в множитель 0.9275 (1 − 0.0725).
- Побочных эффектов нет: нет файлов, сети и процессов, только чтение одной переменной окружения.

## Улики
- `file *`
  - `Legacy.Pricing.dll: PE32 executable (DLL) ... Mono/.Net assembly`
  - `libcalc.so: ELF 64-bit LSB shared object, ARM aarch64 ... stripped`
  - `vendor-tool: ELF 64-bit LSB executable, x86-64 ... statically linked, stripped`
- `readelf -d libcalc.so | grep NEEDED`
  - `Shared library: [libstdc++.so.6]`
- `nm -D --defined-only -C libcalc.so`
  - `0000000000000740 T tariff::Calculator::version()`
  - `00000000000006f0 T tariff::Calculator::surcharge(int, std::__cxx11::basic_string<...> const&) const`
  - `0000000000000750 T calc_api_level`
- `readelf -h vendor-tool`
  - `Machine: Advanced Micro Devices X86-64`
- `objdump -d vendor-tool`
  - `mov $0x1,%eax; lea 0xff4(%rip),%rsi # 0x402000; mov $0x1a,%edx; syscall` (write, 26 байт)
  - `mov $0x3c,%eax; ... syscall` (exit)
- `objdump -s -j .rodata vendor-tool`
  - `402000 76656e64 6f722d74 6f6f6c20 322e3120 vendor-tool 2.1`
  - `402010 6275696c 64203838 340a00 build 884.`
- `ilspycmd Legacy.Pricing.dll`
  - `if (Environment.GetEnvironmentVariable("PRICING_TIER_OVERRIDE") == "ignore-tier") return amount;`
  - `if (!(tier == "gold")) return amount * 0.9275m; return amount * 0.8550m;`
  - `private const decimal LoyaltyRate = 0.0725m;`

## Что предлагаю
- Не запускать vendor-tool на проде. Если нужен реальный запуск, делать это в изолированном окружении x86-64 (эмуляция или отдельный хост) без сети. Вывод и так известен из статического анализа.
- libcalc.so нужна среда aarch64 с libstdc++.so.6. Сигнатуры `surcharge` и `version` выведены только из манглинга, поведение не проверялось. Запросить у подрядчика заголовки или исходники и описание ABI.
- Legacy.Pricing: у переменной `PRICING_TIER_OVERRIDE=ignore-tier` обходной эффект: скидка отключается полностью, и в любом окружении, где она задана. Согласовать с подрядчиком, нужен ли такой режим. Переменную не выставлять в проде.
- Скидки зашиты в код: 14,5% для gold и 7,25% для остальных. Сверить их с бизнес-правилами. `LoyaltyRate` не используется напрямую, возможна рассинхронизация при правке.
- Получить у подрядчика исходники и подписи или хеши файлов. Сейчас происхождение непроверяемо.
