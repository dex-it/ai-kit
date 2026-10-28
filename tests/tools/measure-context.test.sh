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

[ "$fail" -eq 0 ] && echo "measure-context.test.sh: все проверки прошли" || echo "measure-context.test.sh: есть провалы"
exit "$fail"
