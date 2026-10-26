#!/usr/bin/env bash
# Стенд eval55 (tests/eval55/run.mjs) без платных вызовов: `claude` подменён заглушкой. Проверяется каркас: наборы строятся,
# изоляция среды в аргументах, закреплённая модель, грейдеры отличают правку от бездействия, бюджет останавливает серию,
# повторный запуск продолжает, а не дублирует, каталог внутри репозитория отвергается.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; [ -n "${2:-}" ] && echo "$2" | sed 's/^/     | /'; fail=1; }
R="$root/tests/eval55/run.mjs"

mkdir -p "$tmp/bin"
cat > "$tmp/bin/claude" <<'STUB'
#!/bin/sh
# STUB_MODE: fix (по умолчанию) чинит mean при слове «Почини»; wander дополнительно правит README.md.
# STUB_MODEL подменяет модель в modelUsage. Аргументы вызова пишутся в $STUB_LOG.
[ "$1" = "--version" ] && { echo "9.9.9 (stub)"; exit 0; }
{ printf '%s\n' "$@"; echo '---'; } >> "${STUB_LOG:-/dev/null}"
model=""; prev=""
for a in "$@"; do [ "$prev" = "--model" ] && model="$a"; prev="$a"; done
if printf '%s' "$2" | grep -q 'Почини' && [ -f src/stats.js ]; then
  sed -i.bak 's|return xs.reduce((a, b) => a + b, 0) / xs.length;|return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;|' src/stats.js && rm -f src/stats.js.bak
fi
if [ "${STUB_MODE:-fix}" = wander ] && [ -f README.md ]; then echo "extra" >> README.md; fi
printf '{"type":"result","subtype":"success","is_error":false,"result":"готово","total_cost_usd":0.01,"num_turns":2,"duration_ms":5,"usage":{"input_tokens":1,"output_tokens":1},"modelUsage":{"%s":{}}}\n' "${STUB_MODEL:-$model}"
STUB
chmod +x "$tmp/bin/claude"
run() { PATH="$tmp/bin:$PATH" STUB_LOG="${STUB_LOG:-$tmp/log}" node "$R" "$@"; }

# 1. наборы строятся
out=$(run selftest 2>&1) && ok "selftest: наборы строятся, грейдеры известны, ограничения E5 есть в исходных текстах" || bad "selftest" "$out"

# 2. план без вызовов
: > "$tmp/log"; out=$(run plan all 2>&1)
{ echo "$out" | grep -q 'Итого' && [ ! -s "$tmp/log" ]; } && ok "plan: оценка есть, claude не вызван" || bad "plan" "$out"

# 3. E10, чинящий исполнитель: изоляция в аргументах, закреплённая модель, правка засчитана
: > "$tmp/log"; run run E10 --out "$tmp/o1" --budget 5 --tiers haiku --reps 1 --conditions scope-line --parallel 1 >"$tmp/r1.txt" 2>&1
rows=$(wc -l < "$tmp/o1/results.jsonl" | tr -d ' ')
[ "$rows" = 3 ] && ok "run E10: 3 ячейки записаны" || bad "run E10: ожидали 3 ячейки, получили $rows" "$(cat "$tmp/r1.txt")"
grep -qx -- '--setting-sources' "$tmp/log" && grep -qx -- 'project' "$tmp/log" && grep -qx -- '--strict-mcp-config' "$tmp/log" && ! grep -qx -- '--restricted' "$tmp/log" \
  && ok "task-прогон: --setting-sources project --strict-mcp-config" || bad "task-прогон без изоляции" "$(head -30 "$tmp/log")"
grep -qx -- 'claude-haiku-5-5' "$tmp/log" && ok "модель закреплена полным идентификатором" || bad "модель не закреплена"
python3 - "$tmp/o1/results.jsonl" <<'PY' && ok "грейдеры: починка засчитана, правки вне границы нет" || bad "грейдеры E10 при чинящем исполнителе"
import json,sys
rows={r['case']:r for r in map(json.loads,open(sys.argv[1]))}
assert rows['fix-bug']['score']==1.0, rows['fix-bug']
assert rows['nothing-to-fix']['score']==1.0 and rows['add-function']['score']==1.0
PY

# 4. блуждающий исполнитель: правка вне границы ловится
STUB_MODE=wander run run E10 --out "$tmp/o2" --budget 5 --tiers haiku --reps 1 --conditions no-scope --parallel 1 >/dev/null 2>&1
python3 - "$tmp/o2/results.jsonl" <<'PY' && ok "грейдеры: лишняя правка README и правка на «менять нечего» ловятся" || bad "грейдеры не поймали лишнюю правку"
import json,sys
rows={r['case']:r for r in map(json.loads,open(sys.argv[1]))}
assert rows['nothing-to-fix']['score']<1.0, rows['nothing-to-fix']
assert rows['add-function']['score']<1.0, rows['add-function']
PY

# 5. текстовый прогон: --restricted
: > "$tmp/log"; run run E3 --out "$tmp/o3" --budget 5 --tiers sonnet --reps 1 --conditions n05 --parallel 1 >/dev/null 2>&1
grep -qx -- '--restricted' "$tmp/log" && grep -qx -- '--strict-mcp-config' "$tmp/log" && ok "text-прогон: --restricted --strict-mcp-config" || bad "text-прогон без изоляции" "$(head -30 "$tmp/log")"

# 6. бюджет останавливает серию (код 3), повтор продолжает
run run E10 --out "$tmp/o4" --budget 0.015 --tiers haiku --reps 1 --parallel 1 >/dev/null 2>&1; code=$?
n1=$(wc -l < "$tmp/o4/results.jsonl" | tr -d ' ')
{ [ "$code" = 3 ] && [ "$n1" -lt 6 ]; } && ok "бюджет: остановка с кодом 3 после $n1 ячеек" || bad "бюджет не остановил серию (код $code, ячеек $n1)"
run run E10 --out "$tmp/o4" --budget 5 --tiers haiku --reps 1 --parallel 1 >/dev/null 2>&1
n2=$(wc -l < "$tmp/o4/results.jsonl" | tr -d ' ')
[ "$n2" = 6 ] && ok "повтор продолжает без дублей (6 ячеек)" || bad "повтор дублирует или недобирает: $n2"

# 7. модель не закреплена -> ошибка ячейки
STUB_MODEL=claude-other run run E3 --out "$tmp/o5" --budget 5 --tiers haiku --reps 1 --conditions n05 --parallel 1 >/dev/null 2>&1; code=$?
{ [ "$code" = 1 ] && grep -q 'модель не закреплена' "$tmp/o5/results.jsonl"; } && ok "несовпадение модели - ошибка ячейки" || bad "несовпадение модели не поймано (код $code)"

# 8а. repo-ячейка: песочница - копия коммита, вариант «без правила» применён к CLAUDE.md
run run E2 --out "$tmp/o6" --budget 5 --tiers haiku --reps 1 --conditions without-rule --parallel 1 --keep >/dev/null 2>&1; code=$?
sb=$(ls -d "$tmp"/o6/w/E2-without-rule-* 2>/dev/null | head -1)
{ [ "$code" = 0 ] && [ -f "$sb/CLAUDE.md" ] && ! grep -q 'Пунктуация в артефактах - ASCII' "$sb/CLAUDE.md" && grep -q 'Структура плагина' "$sb/CLAUDE.md"; } \
  && ok "repo-ячейка: копия коммита, правило снято, остальной CLAUDE.md на месте" || bad "repo-ячейка (код $code, песочница '$sb')"

# 8. каталог внутри репозитория отвергается
out=$(run run E3 --out "$root/tests/eval55/_x" --budget 1 --tiers haiku --reps 1 2>&1); code=$?
{ [ "$code" != 0 ] && echo "$out" | grep -q 'внутри репозитория' && [ ! -e "$root/tests/eval55/_x" ]; } && ok "--out внутри репозитория отвергнут" || bad "--out внутри репозитория не отвергнут" "$out"

# 9. отчёт
out=$(run report "$tmp/o1" "$tmp/o1" 2>&1); echo "$out" | grep -q 'Полоса шума' && echo "$out" | grep -q '| E10 | haiku | scope-line |' && ok "report: таблицы и полоса шума" || bad "report" "$out"

exit $fail
