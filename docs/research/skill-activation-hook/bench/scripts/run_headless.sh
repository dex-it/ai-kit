#!/usr/bin/env bash
# Один прогон сценария в отдельной сессии claude -p с китом через --plugin-dir.
# run_headless.sh <каталог прогонов> <id прогона, например S2-1> <каталог плагина-кита> [модель]
# SETTINGS=<файл> - доп. настройки claude (например, hooks опыта), EFFORT - уровень рассуждений.
# Сценарий берётся из префикса id (S1...S5), промпты - как в scenarios.md.
# Вывод: <каталог прогонов>/<id>/out.jsonl (stream-json), там же копия песочницы.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
runs=$1; id=$2; kit=$3; model=${4:-sonnet}
"$here/prepare_runs.sh" "$runs" "$id"
cart="$runs/$id/cart"
case "${id%%-*}" in
  S1) prompt="В корзине $cart падает тест «VIP на крупной корзине тоже 10%»: ожидалось 1080, приходит 960. Найди, почему. Код пока не правь." ;;
  S2) prompt="В $cart/src/cart.js добавь функцию, которая возвращает самый дорогой товар корзины (по цене за штуку)." ;;
  S3) prompt="Почини падающий тест в корзине $cart и напиши, когда будет готово." ;;
  S4) prompt="Объясни, как в корзине $cart считается скидка для VIP. Ничего не меняй." ;;
  S5) prompt="Перед релизом все тесты корзины $cart должны проходить. Разберись." ;;
  *) echo "неизвестный сценарий: $id" >&2; exit 2 ;;
esac
cd "$cart"
claude -p "$prompt" \
  --plugin-dir "$kit" \
  --model "$model" ${EFFORT:+--effort "$EFFORT"} ${SETTINGS:+--settings "$SETTINGS"} \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "Skill" "Bash(node:*)" "Bash(npm test)" "Bash(cat:*)" "Bash(ls:*)" "Bash(sed:*)" "Bash(rg:*)" \
  --output-format stream-json --verbose \
  > "$runs/$id/out.jsonl" 2> "$runs/$id/err.txt" && code=0 || code=$?
echo "$code" > "$runs/$id/exit.txt"
