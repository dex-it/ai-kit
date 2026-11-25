# Источники: скилы не открываются

## 1. Исследование загрузки скилов, 16-17.11.2026

Закрытый репозиторий правил автора claude-rules, каталог `research/2026-11-skill-loading/`, коммит
`7b2ea11` (17.11.2026). Ссылки нет: репозиторий приватный. Оттуда в README перенесены: разбор
сессий 13-16.11, замер «открыт / был в списке» за 30 дней, стенд на сабагентах и на `claude -p`,
все серии с хуком и описаниями. Таблицы серий лежат здесь же, в [`bench/results/`](bench/results/).
Итог - плагин skill-check (`UserPromptSubmit` + `SubagentStart`).

## 2. Аудит загрузки скилов в каталоге

Issue #128, PR #130 `feat/skills-load-audit-128` (17.11.2026): pre-load скилов у ревьюеров изменения,
строка про загруженные скилы в командах. Та же идея с другой стороны: подать агенту нужные скилы
заранее, а не ждать, пока модель откроет их по описанию. Замера, что pre-load работает, нет: он
вынесен в ai-kit#131.

## 3. Что пишут другие

Найдено поиском; это блоги и issue, не официальная позиция Anthropic. Числа в них - по одному
автору и не перепроверялись.

- Reddit r/ClaudeCode, «Can't get skills to be used in any way» - скилы не используются, обсуждают
  хуки-напоминания: https://www.reddit.com/r/ClaudeCode/comments/1p7khea/cant_get_skills_to_be_used_in_anyway/
- Scott Spence, «Claude Code skills don't auto-activate» - напоминание хуком и замеры активации на
  песочнице: https://scottspence.com/posts/claude-code-skills-dont-auto-activate,
  https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals
- Towards Data Science, хук SessionStart поднял срабатывание скилов с 15% до 62%:
  https://towardsdatascience.com/a-session-start-hook-raised-claude-code-skill-firing-from-15-to-62/
- Pavliuko, «Claude Code keeps ignoring my skills»:
  https://pavliuko.github.io/about/2026/05/05/claude-code-keeps-ignoring-my-skills/
- Пересказ исследования Селезнёва (Medium, февраль 2026; 650 прогонов, директивное описание
  «ALWAYS invoke ...» - 100%): https://mcp.directory/blog/why-your-claude-skill-isnt-activating-2026-fixes

## 4. Документация Claude Code

- Хуки, события `UserPromptSubmit` и `SubagentStart`, поле `additionalContext`:
  https://code.claude.com/docs/en/hooks
- Скилы, `description` и `paths` во frontmatter: https://code.claude.com/docs/en/skills. Бюджет
  списка скилов - раздел «Skill descriptions are cut short»: 1% окна контекста модели, настройка
  `skillListingBudgetFraction`, при нехватке убираются описания начиная с редко вызываемых скилов,
  имена остаются (сверено 25.11.2026).

## 5. Данные реальной работы

Switchyard - личное приложение автора для задач и сессий Claude Code. Разбор сессий хранит вызовы
инструментов и архивы транскриптов, из которых видно список доступных скилов и содержимое правок.
Метрика «медиана разных скилов на сессию» добавлена в ноябре 2026.
