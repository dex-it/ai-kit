# Выпуск `develop` -> `main`

Сверено 2026-10-26, `develop` @ `eead0682`, `main` @ `af024401`.

- Релиз - PR `develop` -> `main` целиком. Сливается обычным merge-коммитом, **без squash**, чтобы история `develop` осталась в `main`; `develop` не удалять. Источник: тело PR #6 (релиз 6.27.0). Проверка: `git log origin/main --first-parent --merges`.
- PR фичи в `develop` сливается squash-ем (в истории `develop` один коммит `... (#N)`); следствие для SHA веток - `tests/README.md`, «Реестр прогонов».
- Настройка репозитория не защищает от ошибки: на 2026-10-26 включены все три способа слияния (`gh api repos/dex-it/ai-kit --jq '{squash:.allow_squash_merge,merge:.allow_merge_commit,rebase:.allow_rebase_merge}'`). Защита ветки `main` не прочитана: нужен admin.
- Тегов и GitHub Releases нет (`git tag`, `gh release list` пусты); версия каталога - `version` в `.claude-plugin/marketplace.json`, `main` - канал поставки (`AGENTS.md`, «Адрес документа каталога из README плагина»).
- Версии и их синхронизация - `.claude/rules/plugin-changes.md`; ветка и PR в `develop` - `docs/guide/contributing/pull-requests.md`. Здесь не повторяются.
