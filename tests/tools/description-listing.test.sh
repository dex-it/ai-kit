#!/usr/bin/env bash
# description-listing: бюджет листинга, пары по близости, листинг при установке бандла.
# Фикстура: два почти одинаковых описания (a, b) и одно далёкое (c); агент вне бандла; бандл включает a и c.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

mk() { # kind-dir name plugin description
  local d="$tmp/plugins/skills/$2/skills/$1"; mkdir -p "$d"
  printf -- '---\nname: %s\ndescription: "%s"\n---\nТело.\n' "$1" "$3" > "$d/SKILL.md"
}
mk a dex-skill-a 'Ловушки Entity Framework Core: миграции, запросы, concurrency, mapping. Активируется при ef core, миграции, DbContext'
mk b dex-skill-b 'Ловушки Entity Framework Core: миграции, запросы, concurrency, mapping. Активируется при ef core, миграции, DbContext, конфликт'
mk c dex-skill-c 'Реестр стеков и загрузка профильных навыков. Активируется при манифест проекта, определение языка репозитория'
mkdir -p "$tmp/plugins/specialists/x/dex-agent/agents" "$tmp/plugins/bundles/dex-bundle-t"
printf -- '---\nname: ag\ndescription: Агент-аудитор\n---\nТело.\n' > "$tmp/plugins/specialists/x/dex-agent/agents/ag.md"
printf '{"includes":["dex-skill-a"],"dependencies":["dex-skill-c"]}\n' > "$tmp/plugins/bundles/dex-bundle-t/bundle.json"

run() { MARKETPLACE_ROOT="$tmp" node "$root/tools/description-listing.js" "$@"; }

out=$(run)
echo "$out" | grep -q '^| skills | 3 |' && ok "бюджет: три skills" || bad "бюджет skills: $out"
echo "$out" | grep -q '^| агенты | 1 |' && ok "бюджет: один агент" || bad "бюджет агентов"

pairs=$(run --pairs=0.5)
echo "$pairs" | grep -q 'skill:dex-skill-a:a.*skill:dex-skill-b:b' && ok "пара a-b выше порога" || bad "пара a-b не найдена: $pairs"
echo "$pairs" | grep -q 'dex-skill-c' && bad "далёкое описание попало в пары" || ok "далёкое описание в пары не попало"
[ "$(run --pairs=0.99 | grep -c '^| [0-9]')" = "0" ] && ok "порог 0,99: пар нет" || bad "порог 0,99 пропустил пары"

b=$(run --bundles | grep 'dex-bundle-t')
echo "$b" | grep -q '| 2 | 2/' && ok "бандл: includes и dependencies, агент вне бандла не считается" || bad "бандл: $b"

[ "$fail" -eq 0 ] && echo "description-listing.test.sh: все проверки прошли" || echo "description-listing.test.sh: есть провалы"
exit "$fail"
