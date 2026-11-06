#!/usr/bin/env bash
# measure-context: счёт "длинных предложений" идёт по строке Markdown. Заголовок без точки, строки с метками
# (Плохо:, Правильно:, Почему:) и пункты списка не склеиваются в одно предложение; жёсткий перенос внутри
# фразы склеивается. Фикстура: 6 предложений, из них одно длинное (26+ слов) -> 17%; со склейкой было бы 100%.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

d="$tmp/plugins/skills/dex-skill-fixture/skills/fixture"
mkdir -p "$d"
cat > "$d/SKILL.md" <<'MD'
---
name: fixture
description: Фикстура счёта предложений.
---
## Заголовок без точки в конце

Плохо: делать это так себе
Правильно: делать вот так хорошо
Почему: потому что так надо делать всегда
- пункт списка без точки в конце строки
- ещё один пункт списка без точки тоже

Это одно длинное предложение с жёстким переносом строки, которое тянется по двум строкам
и содержит заведомо больше двадцати пяти слов, чтобы попасть в счёт длинных, а не в короткие.
MD

pct=$(MARKETPLACE_ROOT="$tmp" node "$root/tools/measure-context.js" --json | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0,"utf8")).skills.total.longSentencePct))')
[ "$pct" = "17" ] && ok "долгие предложения считаются по строке: 1 из 6 -> 17" || bad "ожидалось 17, получено $pct"

# --prohibitions: слова-запреты по областям. Фикстура: по файлу на область, в каждой известное число вхождений;
# docs/migration и docs/research в счёт не идут, граница слова по \p{L} (подстрока "ненельзя" не считается).
p="$tmp/prohib"; mkdir -p "$p/plugins/x/dex-x/agents" "$p/plugins/x/dex-x/commands" "$p/plugins/x/dex-x/skills/s/references" "$p/docs/migration" "$p/docs/research" "$p/.claude/rules"
printf -- '---\nname: a\n---\nЭто нельзя. Запрещено. Никогда не ври.\nне делай этого\n' > "$p/plugins/x/dex-x/agents/a.md"
printf -- 'ни в коем случае, MUST\n' > "$p/plugins/x/dex-x/commands/c.md"
printf -- 'ненельзя и запрещённое\n' > "$p/plugins/x/dex-x/skills/s/SKILL.md"
printf -- 'нельзя\n' > "$p/plugins/x/dex-x/skills/s/references/r.md"
printf -- 'нельзя нельзя\n' > "$p/docs/D.md"
printf -- 'нельзя\n' > "$p/docs/migration/m.md"
printf -- 'нельзя\n' > "$p/docs/research/r.md"
printf -- 'запрещено\n' > "$p/AGENTS.md"
printf -- 'никогда\n' > "$p/.claude/rules/r.md"
got=$(MARKETPLACE_ROOT="$p" node "$root/tools/measure-context.js" --prohibitions --json | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(["agents","commands","skills","skills-references","docs","root","rules"].map((a)=>a+"="+r.areas[a].total).join(" ")+" total="+r.total+" caps="+r.areas.commands.caps)')
want="agents=4 commands=1 skills=1 skills-references=1 docs=2 root=1 rules=1 total=11 caps=1"
[ "$got" = "$want" ] && ok "слова-запреты по областям: $got" || bad "ожидалось '$want', получено '$got'"

[ "$fail" -eq 0 ] && echo "measure-context.test.sh: все проверки прошли" || echo "measure-context.test.sh: есть провалы"
exit "$fail"
