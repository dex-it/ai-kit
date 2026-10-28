# Проба удержания S1 (#16)

Не набор trap-skill: проверяет, что ручная правка skills группы S1 не сняла факты, нужные исполнителю. Вопрос на ловушку, регулярный грейдер, три плеча: `old` (skill с `origin/develop`, при ссылках - вместе с `references/`), `new` (рабочее дерево), `none` (без skill). Без инструментов (`--restricted`), каталог прогона вне репозитория.

```
node tests/trap-skills/_s1-retention/probe.mjs claude-haiku-5-5 old,new,none 5 1.0 out-h.jsonl
node tests/trap-skills/_s1-retention/probe.mjs claude-sonnet-5-5 old,new,none 3 4.0 out-s.jsonl
node tests/trap-skills/_s1-retention/sum.mjs out-h.jsonl out-s.jsonl
```

Платная: потолок в аргументе, прогон останавливается при его достижении. Стоимость серии (29.10.2026): Haiku 5 прогонов 0,19 USD, Sonnet 3 прогона 2,94 USD. Грейдеры - регулярки по словам ответа, поэтому ловят формулировку, а не смысл: расхождение в один прогон на вопрос считается шумом. Результаты и критерий - `docs/migration/claude55-rubric.md`, журнал S1.
