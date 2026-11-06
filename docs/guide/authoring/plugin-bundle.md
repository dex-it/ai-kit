---
title: Плагин и бандл
description: Как завести плагин в каталоге - манифест, запись marketplace.json, витрина README, версии - и как собрать бандл, чтобы он был замкнут и не ломал установку.
---

Любая единица каталога (skill, агент, команда, утилита, мод) становится видимой только когда она оформлена как **плагин**: у неё есть манифест и запись в каталоге. Бандл - особый плагин без кода: список, который ставит скрипт. Страница описывает оформление; сами единицы - на соседних страницах раздела. Короткая памятка того же содержания: [Добавить плагин](/contributing/add-plugin/), правила версий: [Версии](/contributing/versions/).

## Что такое плагин в этом каталоге

Каталог каталогов: `.claude-plugin/marketplace.json` перечисляет плагины, каждый лежит в своей папке и несёт `.claude-plugin/plugin.json`. Как это связано, показано на странице [Сборка каталога](/architecture/catalog-assembly/).

## Шаги: от папки до записи в каталоге

1. **Выберите вид и каталог** (категория выводится из содержимого, вы её не назначаете):

   | Вид | Где | Имя | Что внутри |
   |---|---|---|---|
   | Skill | `plugins/skills/` | `dex-skill-{name}` | `skills/<имя>/SKILL.md` |
   | Специалист | `plugins/specialists/<область>/` | `dex-{domain}-{role}` или `dex-{name}-specialist` | `agents/`, при нужде `commands/` |
   | Утилита | `plugins/utilities/` | `dex-{name}` | `commands/`, `hooks/hooks.json` с ключом `hooks` |
   | Бандл | `plugins/bundles/` | `dex-bundle-{role}` | `bundle.json`, `README.md` |
   | Мод | `mods/` | `dex-{name}` | `hooks/hooks.json` с ключом `modules`, TypeScript |

2. **Создайте манифест** `.claude-plugin/plugin.json`. Реальный образец, `plugins/skills/dex-skill-redis/.claude-plugin/plugin.json`:

   ```json
   {
     "name": "dex-skill-redis",
     "version": "1.2.1",
     "description": "Redis: старт без Redis, промахи горячего ключа, потеря распределённого лока, лимит запросов на границе окон.",
     "author": { "name": "Dex Team", "email": "mmx@dex-it.ru" },
     "keywords": ["skill", "redis", "cache", "distributed", "stampede"],
     "repository": "https://github.com/dex-it/ai-kit",
     "license": "GPL-3.0"
   }
   ```

   Здесь `description` - **витрина** для человека в списке `/plugin`: по-русски и по телу плагина. Копировать в неё поле срабатывания из frontmatter skill или агента нельзя (триггеры в витрине ухудшают обе стороны), правило `description-not-russian` предупредит о витрине без кириллицы. Не пишите точные числа внутренних единиц («семь фокусов»): число живёт в теле, а в трёх копиях описания оно разойдётся. Состав бандла в манифест не кладут: Claude Code строго проверяет `plugin.json`, неизвестные поля ломают плагин, поэтому состав живёт в `bundle.json`.

3. **Добавьте запись в `.claude-plugin/marketplace.json`:** `name`, `source` (путь вида `./plugins/skills/dex-skill-redis`), `description`, `version`, `category`, `keywords`. `category` выводится из содержимого: `bundle.json` - `bundle`; `agents/` - `specialist`; `skills/` - `skill`; `hooks/hooks.json` с ключом `modules` - `mod`; `hooks/` или `commands/` - `utility`. После правки описания в `plugin.json` запустите `npm run sync:marketplace`: он обновит каталожную копию описания и версии.

4. **Назовите плагин в витрине `README.md`.** Форму имени задаёт шапка таблицы: в таблице бандлов - короткая (`architect`), в перечне skills - короткая форма skill (`ddd`), в прочих - полное имя (`dex-architect`). Нарушения: `readme-plugin-unnamed` (плагин не назван) и `readme-row-ghost` (строка ведёт на несуществующее имя).

5. **Поднимите версии.** Новый плагин - `1.0.0`, версия каталога - minor вверх (в `marketplace.json` и в подвале README). Правки существующего - по [таблице semver](/architecture/catalog-assembly/).

6. **Прогоните проверки:** `npm run validate` и `npm run sync:marketplace -- --check`, затем `npm run precheck`.

## Бандл

Бандл - набор под роль, одним скриптом: `./install-bundle/install-bundle.sh <имя>` (имя без `dex-bundle-`). Установка плоская, поэтому бандл заранее ставит всё нужное: агент без своих skills запустится, но будет работать вслепую.

```text
plugins/bundles/dex-bundle-<роль>/
  .claude-plugin/plugin.json
  bundle.json
  README.md
```

`bundle.json` реального бандла `dex-bundle-runtime-diagnostics`:

```json
{
  "includes": ["dex-dotnet-runtime-diagnostician", "dex-netcoredbg-cli", "dex-skill-observability"],
  "dependencies": ["dex-skill-node-contract", "dex-skill-core-dumps", "dex-skill-managed-debug", "..."]
}
```

| Список | Что это |
|---|---|
| `includes[]` | профиль роли: то, ради чего бандл собран |
| `dependencies[]` | подтянутое замыканием: skills и соседи, на которые опираются компоненты профиля |
| `authorOnly[]` | плагины, нужные только автору каталога в локальном клоне (где `docs/` рядом); в бандл роли для пользователя не ставятся |

### Замкнутость

Главное правило бандла: **каждый артефакт, который компонент бандла называет полной формой `dex-X:Y`, обязан ехать в том же бандле.** Причина: установка плоская, каскада «агент - его skills» нет. Недостающий артефакт не приедет, а агент молча потеряет часть знаний; ссылка при этом выглядит валидной. Нарушения ловят `bundle-not-closed` (агент или скрипт трека), `bundle-agent-not-closed` (skill), `bundle-command-not-closed` (команда). Обратная сторона - `dependency-not-pulled`: запись в `dependencies[]`, которую никто не называет, лишняя.

Когда агент называет артефакт как один вариант из меню (стековый кодер для .NET или TS), вызов помечается `` `[справочно]` `` вплотную за вызовом: так замыкание не заставляет тащить все варианты.

Практический рецепт: после добавления компонента или новой ссылки запустите `npm run validate:bundles`: сообщение назовёт недостающий плагин. Добавьте его в `dependencies[]`, поднимите версию бандла (minor) и версию каталога не забудьте тоже, если менялся состав плагинов.

Моды в бандлы не входят: они меняют поведение клиента и включаются адресно.

## Переименование и снятие

Переименование плагина - major. Установщики ничего не снимают, поэтому в том же PR заводится строка в таблице «Renamed and removed plugins» файла `install-bundle/README.md` (старое имя, замена или `-`, причина), а в описании PR - строка про ручное снятие. Подробности - [Сборка каталога](/architecture/catalog-assembly/).

## Чек-лист перед PR

- [ ] манифест: `name`, `version`, русская витрина, `keywords`
- [ ] запись в `marketplace.json`, `npm run sync:marketplace -- --check` без расхождений
- [ ] плагин назван в витрине README в нужной форме
- [ ] версия плагина и версия каталога подняты
- [ ] если компонент входит в бандл: `bundle.json` и версия бандла обновлены, бандл замкнут
- [ ] для снятого или переименованного плагина: строка в таблице снятых
- [ ] `npm run precheck` зелёный
