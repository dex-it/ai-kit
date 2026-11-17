#!/usr/bin/env bash
# tests/skills-load: сухой прогон раннера (раскрытие ветка:повтор, отказы) и счёт по синтетическому потоку. claude не вызывается
# и не нужен: платный замер кейса здесь не выполняется, проверяется только оснастка.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
run="$root/tests/skills-load/run.sh"
fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

out=$(SKILLS_LOAD_DRY_RUN=1 bash "$run" /tmp/skills-load-dry plain:1..2 line:3 2>&1); rc=$?
[ "$rc" -eq 0 ] && [ "$out" = $'plain:1\nplain:2\nline:3' ] && ok "раскрытие plain:1..2 line:3" || bad "раскрытие: код $rc, вывод «$out»"
for spec in plain:3..1 other:1 plain:a plain:1..; do
  SKILLS_LOAD_DRY_RUN=1 bash "$run" /tmp/skills-load-dry "$spec" >/dev/null 2>&1; rc=$?
  [ "$rc" -eq 2 ] && ok "отказ на $spec" || bad "$spec: код $rc вместо 2"
done
[ ! -e /tmp/skills-load-dry ] && ok "сухой прогон не создаёт каталогов" || bad "сухой прогон оставил след"

got=$(node "$root/tests/skills-load/score.mjs" "$root/tests/skills-load/fixtures" 2>&1)
case "$got" in
  *"с вызовом Skill 1, с обоими ожидаемыми 1, с полем skills-loaded 1"*) ok "счёт по синтетическому потоку" ;;
  *) bad "счёт: $got" ;;
esac
exit $fail
