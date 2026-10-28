# Проба удержания S3 (#17)

Не набор trap-skill: проверяет, что ручная правка skills группы S3 не сняла факты, нужные исполнителю. Вопрос на правку, регулярный грейдер, три плеча: `old` (skill с `origin/develop`), `new` (рабочее дерево), `none` (без skill). Без инструментов (`--restricted`), каталог прогона вне репозитория. Раннер, суммирование и формат - как у [`_s1-retention`](../_s1-retention/README.md).

```
node tests/trap-skills/_s3-retention/probe.mjs claude-haiku-5-5 old,new,none 5 1.5 out-h.jsonl
node tests/trap-skills/_s3-retention/probe.mjs claude-sonnet-5-5 old,new,none 3 5.0 out-s.jsonl
node tests/trap-skills/_s3-retention/regrade.mjs out-h.jsonl out-h2.jsonl   # перепроверка сохранённых ответов текущими грейдерами
node tests/trap-skills/_s1-retention/sum.mjs out-h2.jsonl out-s2.jsonl
node tests/trap-skills/_s3-retention/route.mjs claude-sonnet-5-5 3 1.5 route-s.jsonl
```

`route.mjs` - проба различимости `description` 18 skills группы: листинг только группы (не вся библиотека), реплика пользователя, ответ - имя skill. Это не E7 (рост библиотеки до 30 и 100 skills не проверяется) и не E13.

Платная; потолок в аргументе. Грейдеры - регулярки по словам ответа: ловят формулировку, а не смысл. Результаты, расход и оговорки - `docs/migration/claude55-rubric.md`, журнал S3.
