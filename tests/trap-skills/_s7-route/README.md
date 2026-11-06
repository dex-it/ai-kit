# Проба S7 (#21): различимость description и парная перепроверка наборов .NET

Не новый набор trap-skill. Две части, обе платные, потолок задан в аргументах.

## 1. Различимость description (`route.mjs`)

Листинг 9 skills группы и `ts-vitest-jest` (пара с похожим описанием), 20 реплик (по две на skill), ответ - одно имя skill. Не E7: рост библиотеки до 30 и 100 skills не проверяется.

```
node tests/trap-skills/_s7-route/route.mjs claude-haiku-5-5 5 0.2 route-h.jsonl
node tests/trap-skills/_s7-route/route.mjs claude-sonnet-5-5 1 0.4 route-s.jsonl
```

## 2. Парная перепроверка: текущий skill против без skill

Готовые кейсы ревью наборов, раннеры без изменений (`_projects/billing/run-group-2-1.sh`, `_projects/pricing/run-group-2-2.sh`), `claude-sonnet-5-5` medium, CLI 2.1.311, 28.10.2026. Множество `w` - skill из `develop` подан копией `SKILL.md` (`runs/<кейс>-w1`), множество `z` - без skill (`runs/<кейс>-z1`). По одному прогону на плечо: полосы шума нет, это проверка на дым, а не измерение.

```
export G21_WORK=<каталог вне репозитория> G22_WORK=<каталог вне репозитория>
LC_CTYPE=C bash tests/trap-skills/_projects/billing/run-group-2-1.sh rv-q w 1 plugins/skills/dex-skill-dotnet-code-quality/skills/dotnet-code-quality/SKILL.md
LC_CTYPE=C bash tests/trap-skills/_projects/billing/run-group-2-1.sh rv-q z 1
```

Кейсы: `rv-q`, `rv-l1`, `rv-v`, `rv-a` (billing; code-quality, logging, validation, async-patterns) и `rv-s`, `rv-a`, `rv-c`, `rv-t` (pricing; resilience, api-development, csproj-hygiene, testing-patterns). Засчитывание - по ключу кейса в README мини-проекта, вручную читал один человек (исполнитель задачи), судьи нет.

Сбой раннера `rv-t-z1`: исполнитель записал ревью командой `cat > REVIEW.md <<EOF ... ; grep -c ...`, составная команда не прошла разрешения, `REVIEW.md` не создан. Текст ревью восстановлен из аргумента этой команды в журнале `stream-json` дословно; повторный прогон не делался (потолок).

Результаты, расход и оговорки - `docs/migration/claude55-rubric.md`, журнал S7.
