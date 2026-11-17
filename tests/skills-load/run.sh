#!/usr/bin/env bash
# run.sh <каталог> <ветка:повтор>...: прогон агента dex-dotnet-coder:dotnet-coder на одной задаче, каждый - своим `claude -p`
# в своей песочнице. Ветки: plain - бриф без строки про skills-loaded, line - бриф со строкой (inputs/). Повтор - число
# либо диапазон 1..3. Результат - <каталог>/<ветка>-<n>.jsonl (stream-json) для score.mjs.
# SKILLS_LOAD_DRY_RUN=1 печатает раскрытые прогоны и выходит, не требуя claude (проверка - tests/tools/skills-load.test.sh).
# Прогон платный, в `npm test` и CI не входит. Среда оператора в прогон не идёт (tests/README.md, «Среда прогона раннеров
# `claude -p`»): `--setting-sources project --strict-mcp-config`; OPERATOR_ENV=1 снимает изоляцию. Плагины агента и его
# скиллов подаются каталогами рабочего дерева: SKILLS_LOAD_PLUGINS="<каталог> <каталог>" (каждый - как --plugin-dir).
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out=${1:-}; shift || true
[ -n "$out" ] && [ $# -gt 0 ] || { echo "usage: run.sh <каталог> <ветка:повтор>..." >&2; exit 2; }

runs=()
for spec in "$@"; do
  arm=${spec%%:*}; rep=${spec#*:}
  case "$arm" in plain|line) ;; *) echo "неизвестная ветка: $arm" >&2; exit 2 ;; esac
  if [[ "$rep" =~ ^([0-9]+)\.\.([0-9]+)$ ]]; then
    a=$((10#${BASH_REMATCH[1]})); b=$((10#${BASH_REMATCH[2]}))
    [ "$a" -le "$b" ] || { echo "обратный диапазон: $spec" >&2; exit 2; }
    n=$a; while [ "$n" -le "$b" ]; do runs+=("$arm:$n"); n=$((n+1)); done
  elif [[ "$rep" =~ ^[0-9]+$ ]]; then runs+=("$arm:$((10#$rep))")
  else echo "неверный повтор: $spec" >&2; exit 2; fi
done

if [ "${SKILLS_LOAD_DRY_RUN:-}" = 1 ]; then printf '%s\n' "${runs[@]}"; exit 0; fi

iso=(--setting-sources project --strict-mcp-config); [ "${OPERATOR_ENV:-}" = 1 ] && iso=()
plugins=(); for p in ${SKILLS_LOAD_PLUGINS:-}; do plugins+=(--plugin-dir "$p"); done
to=$(command -v timeout || command -v gtimeout) || { echo "нужен timeout (GNU coreutils)" >&2; exit 2; }
mkdir -p "$out"
for r in "${runs[@]}"; do
  arm=${r%%:*}; n=${r#*:}
  work="$out/work-$arm-$n"; rm -rf "$work"; mkdir -p "$work"
  python3 - "$here/inputs/task.md" "$work/Pricing.cs" <<'PY'
import re, sys
t = open(sys.argv[1]).read()
open(sys.argv[2], "w").write(re.search(r"```csharp\n(.*?)```", t, re.S).group(1))
PY
  brief="$here/inputs/brief-$([ "$arm" = line ] && echo with-line || echo plain).md"
  (cd "$work" && "$to" 900 claude -p "$(cat "$brief" "$here/inputs/task.md")" --agent dex-dotnet-coder:dotnet-coder --model sonnet \
     --output-format stream-json --verbose --dangerously-skip-permissions "${iso[@]}" "${plugins[@]}" \
     > "$out/$arm-$n.jsonl" 2> "$out/$arm-$n.err")
  echo "$arm-$n: код $?"
done
