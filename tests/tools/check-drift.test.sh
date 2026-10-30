#!/usr/bin/env bash
# check-drift.js: каждая категория (а)-(г) ловит заведомый дефект на фикстурном дереве и молчит на чистом;
# исключения (пример формы, запись истории, имя без пути из плагина) не дают ложных срабатываний;
# код возврата: 1 при (а)-(в), (г) только с --strict.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

t="$tmp/tree"
mkdir -p "$t/.claude-plugin" "$t/docs" "$t/plugins/skills/dex-skill-alpha/.claude-plugin" "$t/plugins/skills/dex-skill-alpha/skills/alpha/references" "$t/plugins/bundles/dex-bundle-one/.claude-plugin"
cat > "$t/.claude-plugin/marketplace.json" <<'JSON'
{"name":"c","version":"1.2.3","plugins":[
 {"name":"dex-skill-alpha","source":"./plugins/skills/dex-skill-alpha","category":"skill","version":"1.0.0"},
 {"name":"dex-bundle-one","source":"./plugins/bundles/dex-bundle-one","category":"bundle","version":"1.0.0"}]}
JSON
echo '{"name":"dex-skill-alpha"}' > "$t/plugins/skills/dex-skill-alpha/.claude-plugin/plugin.json"
echo '{"name":"dex-bundle-one"}' > "$t/plugins/bundles/dex-bundle-one/.claude-plugin/plugin.json"
printf -- '---\nname: alpha\n---\nТело. См. `references/rule.md`.\n' > "$t/plugins/skills/dex-skill-alpha/skills/alpha/SKILL.md"
echo 'Правило.' > "$t/plugins/skills/dex-skill-alpha/skills/alpha/references/rule.md"
echo '{"scripts":{"validate":"true"}}' > "$t/package.json"
printf '# Каталог\n\n**DEX Team** - Version 1.2.3\n' > "$t/README.md"
printf '@AGENTS.md\n' > "$t/CLAUDE.md"
printf '# Норма\n\n## Именование\n\n**Правило А.** Текст.\n' > "$t/AGENTS.md"

run() { node "$root/tools/check-drift.js" --root "$t" --today 2026-10-30 "$@"; }
count() { run --json "$@" | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));const c={a:0,b:0,c:0,d:0};for(const f of r.findings)c[f.category]++;process.stdout.write(`${c.a}${c.b}${c.c}${c.d}`)'; }

# чистое дерево: ни находок, код 0
cat > "$t/docs/ok.md" <<'MD'
# Док

Верные ссылки: `plugins/skills/dex-skill-alpha`, `npm run validate`, `dex-skill-alpha:alpha`, [раздел](../AGENTS.md#именование),
`AGENTS.md`, «Именование»; `CLAUDE.md`, «Правило А»; раздел «Именование» в `AGENTS.md`.
Примеры формы не судятся: `docs/<имя>/x.md`, `plugins/skills/dex-skill-X/skills/X/SKILL.md`.
Запись истории: каталог `plugins/ai-sdlc/dex-sdlc` снят 07.09.2026.
Сверено 20.10.2026 по документации.
```
`docs/в-блоке-кода.md` и `npm run нет-скрипта` в fenced-блоке не судятся
```
MD
out=$(count); rc=0; run >/dev/null || rc=$?
[ "$out" = "0000" ] && [ "$rc" = 0 ] && ok "чистое дерево: 0 находок, код 0" || bad "чистое дерево: $out rc=$rc"

# (а)
cat > "$t/docs/a.md" <<'MD'
# А

Нет файла `docs/gone.md`, нет скрипта `npm run nosuch`, нет артефакта `dex-skill-alpha:nothing`, нет плагина `dex-skill-ghost:x`.
В артефакте: `references/absent.md`.
MD
printf -- '---\nname: beta\n---\nСм. `references/absent.md`.\n' > "$t/plugins/skills/dex-skill-alpha/skills/alpha/references/beta.md"
out=$(count --only a); rc=0; run --only a >/dev/null || rc=$?
n=$(run --json --only a | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0,"utf8")).findings.length))')
[ "$n" = 5 ] && [ "$rc" = 1 ] && ok "(а): путь, скрипт, артефакт, плагин и references плагина (в docs/ такой путь не судится), код 1" || bad "(а): findings=$n rc=$rc"; run --only a | sed "s/^/     | /"
rm "$t/docs/a.md" "$t/plugins/skills/dex-skill-alpha/skills/alpha/references/beta.md"

# (б)
cat > "$t/docs/b.md" <<'MD'
# Б

Битый якорь [x](../AGENTS.md#нет-такого), нет раздела: `AGENTS.md`, «Снятый раздел»; через импорт `CLAUDE.md`, «Снятый лейбл»; «Ещё один» в `AGENTS.md`; файл [y](gone.md#a).
MD
n=$(run --json --only b | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0,"utf8")).findings.length))'); rc=0; run --only b >/dev/null || rc=$?
[ "$n" = 5 ] && [ "$rc" = 1 ] && ok "(б): якорь, три названия раздела, мёртвый файл; код 1" || bad "(б): findings=$n rc=$rc"; run --only b | sed "s/^/     | /"
rm "$t/docs/b.md"

# (в)
sed -i.bak 's/Version 1.2.3/Version 1.2.2/' "$t/README.md"; rm -f "$t/README.md.bak"
printf '# Гид\n\nВ каталоге 7 плагинов и 3 бандла.\nЗамер 01.09.2026: 85 плагинов.\n' > "$t/README2.md"; mkdir -p "$t/docs/guide"; mv "$t/README2.md" "$t/docs/guide/a.md"
mkdir -p "$t/plugins/skills/dex-skill-orphan/.claude-plugin"; echo '{"name":"dex-skill-orphan"}' > "$t/plugins/skills/dex-skill-orphan/.claude-plugin/plugin.json"
n=$(run --json --only c | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0,"utf8")).findings.length))'); rc=0; run --only c >/dev/null || rc=$?
[ "$n" = 4 ] && [ "$rc" = 1 ] && ok "(в): версия, два счёта (замер с датой не в счёт), плагин вне каталога; код 1" || bad "(в): findings=$n rc=$rc"
sed -i.bak 's/Version 1.2.2/Version 1.2.3/' "$t/README.md"; rm -f "$t/README.md.bak"; rm -r "$t/docs/guide" "$t/plugins/skills/dex-skill-orphan"

# (г)
printf '# Г\n\nСверено 01.01.2025 по документации. Ещё [doc](https://code.claude.com/docs/en/memory), 02.03.2025. Свежее: сверено 20.10.2026.\n' > "$t/docs/d.md"
out=$(count --only d); rc=0; run --only d >/dev/null || rc=$?; rcs=0; run --only d --strict >/dev/null || rcs=$?
[ "$out" = "0002" ] && [ "$rc" = 0 ] && [ "$rcs" = 1 ] && ok "(г): две старые сверки списком, код 0; с --strict код 1" || bad "(г): $out rc=$rc strict=$rcs"
out=$(count --only d --stale-days 2000)
[ "$out" = "0000" ] && ok "(г): порог --stale-days задаёт предел" || bad "(г): порог 2000 дал $out"

# живой каталог: ноль находок (нулевой шум доказывается здесь, а не на фикстуре)
live=$(node "$root/tools/check-drift.js" --root "$root" --json | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(String(r.findings.filter(f=>f.category!=="d").length))')
[ "$live" = 0 ] && ok "живой каталог: 0 находок (а)-(в)" || bad "живой каталог: $live находок (а)-(в), см. npm run check:drift"

[ "$fail" -eq 0 ] && echo "check-drift.test.sh: все проверки прошли" || echo "check-drift.test.sh: есть провалы"
exit "$fail"
