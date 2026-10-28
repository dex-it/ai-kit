# Проба удержания S4 (#18)

Не набор trap-skill: проверяет, что ручная правка норматива этапов `architecture-definition-42010` и `interface-definition-openapi` (и сноски `design-quality`) не сняла факты, нужные исполнителю. Вопрос на ситуацию, регулярный грейдер (все регулярки должны сработать), плечи `old` (`origin/develop`), `new` (рабочее дерево), `none` (без skill), `cand` (только 42010: `new` без столбца "Что несёт" таблицы arc42; кандидат, не применён). Без инструментов (`--restricted`), каталог прогона вне репозитория. Вопросы и грейдеры закоммичены до первого прогона и не расширялись.

```
node tests/trap-skills/_s4-retention/probe.mjs claude-haiku-5-5 old,new,cand,none 5 1.0 out-h.jsonl
node tests/trap-skills/_s4-retention/probe.mjs claude-sonnet-5-5 old,new 2 2.3 out-s.jsonl A1,A2,A3,A5,A6,A12,B1,B2,B3,B4,B5,B6,B7,B8,B10,C1
node tests/trap-skills/_s4-retention/sum.mjs out-h.jsonl out-s.jsonl
```

Платная: потолок в аргументе. Результаты, расход и ограничения (свои вопросы, регулярный судья, полосы шума нет) - `docs/migration/claude55-rubric.md`, журнал S4. Плечо `old` читает `origin/develop`: после слияния PR переменная `S4_BASE` задаёт коммит до правки (`2275416d`).
