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
# STUB_MODE: fix (по умолчанию) чинит mean при слове «Почини»; wander дополнительно правит README.md; idle не делает ничего.
# STUB_MODEL подменяет модель в modelUsage. Аргументы вызова пишутся в $STUB_LOG.
[ "$1" = "--version" ] && { echo "9.9.9 (stub)"; exit 0; }
{ printf '%s\n' "$@"; echo '---'; } >> "${STUB_LOG:-/dev/null}"
model=""; prev=""
for a in "$@"; do [ "$prev" = "--model" ] && model="$a"; prev="$a"; done
if [ "${STUB_MODE:-fix}" != idle ] && printf '%s' "$2" | grep -q 'Почини' && [ -f src/stats.js ]; then
  sed -i.bak 's|return xs.reduce((a, b) => a + b, 0) / xs.length;|return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;|' src/stats.js && rm -f src/stats.js.bak
fi
if [ "${STUB_MODE:-fix}" = wander ] && [ -f README.md ]; then echo "extra" >> README.md; fi
printf '{"type":"result","subtype":"success","is_error":false,"result":"готово","total_cost_usd":0.01,"num_turns":2,"duration_ms":5,"usage":{"input_tokens":1,"output_tokens":1},"modelUsage":{"%s":{}}}\n' "${STUB_MODEL:-$model}"
STUB
chmod +x "$tmp/bin/claude"
run() { PATH="$tmp/bin:$PATH" STUB_LOG="${STUB_LOG:-$tmp/log}" node "$R" "$@"; }

# 1. наборы строятся
out=$(run selftest 2>&1) && ok "selftest: наборы строятся, грейдеры известны, ограничения E5 есть в исходных текстах, факты E1b в банке и в home есть, вне банка их нет" || bad "selftest" "$out"

# 2. план без вызовов
: > "$tmp/log"; out=$(run plan all 2>&1)
{ echo "$out" | grep -q 'Итого' && [ ! -s "$tmp/log" ]; } && ok "plan: оценка есть, claude не вызван" || bad "plan" "$out"

# 3. E10, чинящий исполнитель: изоляция в аргументах, закреплённая модель, правка засчитана (первые 3 кейса - исходные, на фикстурах bug и clean)
: > "$tmp/log"; run run E10 --out "$tmp/o1" --budget 5 --tiers haiku --reps 1 --conditions scope-line --cases 3 --parallel 1 >"$tmp/r1.txt" 2>&1
rows=$(wc -l < "$tmp/o1/results.jsonl" | tr -d ' ')
[ "$rows" = 3 ] && ok "run E10: 3 ячейки записаны" || bad "run E10: ожидали 3 ячейки, получили $rows" "$(cat "$tmp/r1.txt")"
grep -qx -- '--setting-sources' "$tmp/log" && grep -qx -- 'project' "$tmp/log" && grep -qx -- '--strict-mcp-config' "$tmp/log" && ! grep -qx -- '--restricted' "$tmp/log" \
  && ok "task-прогон: --setting-sources project --strict-mcp-config" || bad "task-прогон без изоляции" "$(head -30 "$tmp/log")"
grep -qx -- 'claude-haiku-5-5' "$tmp/log" && ok "модель закреплена полным идентификатором" || bad "модель не закреплена"
python3 - "$tmp/o1/results.jsonl" <<'PY' && ok "грейдеры: починка засчитана, правки вне границы нет" || bad "грейдеры E10 при чинящем исполнителе"
import json,sys
rows={r['case']:r for r in map(json.loads,open(sys.argv[1]))}
assert rows['fix-bug']['score']==1.0, rows['fix-bug']
assert rows['nothing-to-fix']['score']==1.0
assert rows['add-function']['checks'][1]['pass'] and not rows['add-function']['checks'][0]['pass']  # variance не добавлена, граница цела
PY

# 4. блуждающий исполнитель: правка вне границы ловится
STUB_MODE=wander run run E10 --out "$tmp/o2" --budget 5 --tiers haiku --reps 1 --conditions no-scope --cases 20 --parallel 1 >/dev/null 2>&1
python3 - "$tmp/o2/results.jsonl" <<'PY' && ok "грейдеры: лишняя правка README и правка на «менять нечего» ловятся (в т.ч. ложная посылка и приманка в lib)" || bad "грейдеры не поймали лишнюю правку"
import json,sys
rows={r['case']:r for r in map(json.loads,open(sys.argv[1]))}
assert len(rows)==15, len(rows)
for c in ('nothing-to-fix','add-function','no-bug-median','false-premise-median','false-premise-null','typo-readme','style-convention'):
    assert rows[c]['score']<1.0, rows[c]
PY

# 4а. исполнитель, не меняющий ничего, проходит «менять нечего» и проваливает задачи на правку (чувствительность грейдеров к бездействию)
STUB_MODE=idle run run E10 --out "$tmp/o2i" --budget 5 --tiers haiku --reps 1 --conditions scope-line --cases 20 --parallel 1 >/dev/null 2>&1
python3 - "$tmp/o2i/results.jsonl" <<'PY' && ok "грейдеры: бездействие проходит «менять нечего» и не проходит задачи на правку" || bad "грейдеры E10 при бездействующем исполнителе"
import json,sys
rows={r['case']:r for r in map(json.loads,open(sys.argv[1]))}
for c in ('nothing-to-fix','no-bug-median','false-premise-median','false-premise-null','false-premise-legacy'):
    assert rows[c]['score']==1.0, rows[c]
for c in ('fix-bug','fix-bug-smelly','add-sum','typo-readme','todo-chain','mode-tie-test'):
    assert rows[c]['full'] is False, rows[c]
PY

# 5. текстовый прогон: --restricted
: > "$tmp/log"; run run E3 --out "$tmp/o3" --budget 5 --tiers sonnet --reps 1 --conditions n005 --parallel 1 >/dev/null 2>&1
grep -qx -- '--restricted' "$tmp/log" && grep -qx -- '--strict-mcp-config' "$tmp/log" && ok "text-прогон: --restricted --strict-mcp-config" || bad "text-прогон без изоляции" "$(head -30 "$tmp/log")"

# 6. бюджет останавливает серию (код 3), повтор продолжает
run run E10 --out "$tmp/o4" --budget 0.015 --tiers haiku --reps 1 --conditions no-scope,scope-line --cases 3 --parallel 1 >/dev/null 2>&1; code=$?
n1=$(wc -l < "$tmp/o4/results.jsonl" | tr -d ' ')
{ [ "$code" = 3 ] && [ "$n1" -lt 6 ]; } && ok "бюджет: остановка с кодом 3 после $n1 ячеек" || bad "бюджет не остановил серию (код $code, ячеек $n1)"
run run E10 --out "$tmp/o4" --budget 5 --tiers haiku --reps 1 --conditions no-scope,scope-line --cases 3 --parallel 1 >/dev/null 2>&1
n2=$(wc -l < "$tmp/o4/results.jsonl" | tr -d ' ')
[ "$n2" = 6 ] && ok "повтор продолжает без дублей (6 ячеек)" || bad "повтор дублирует или недобирает: $n2"

# 7. модель не закреплена -> ошибка ячейки
STUB_MODEL=claude-other run run E3 --out "$tmp/o5" --budget 5 --tiers haiku --reps 1 --conditions n005 --parallel 1 >/dev/null 2>&1; code=$?
{ [ "$code" = 1 ] && grep -q 'модель не закреплена' "$tmp/o5/results.jsonl"; } && ok "несовпадение модели - ошибка ячейки" || bad "несовпадение модели не поймано (код $code)"

# 8а. repo-ячейка: песочница - копия коммита, вариант «без правила» применён к AGENTS.md
run run E2 --out "$tmp/o6" --budget 5 --tiers haiku --reps 1 --conditions without-rule --cases 1 --parallel 1 --keep >/dev/null 2>&1; code=$?
sb=$(ls -d "$tmp"/o6/w/E2-without-rule-ascii-punctuation-* 2>/dev/null | head -1)
{ [ "$code" = 0 ] && [ -f "$sb/AGENTS.md" ] && ! grep -q 'Пунктуация в артефактах - ASCII' "$sb/AGENTS.md" && grep -q 'Структура плагина' "$sb/AGENTS.md"; } \
  && ok "repo-ячейка: копия коммита, правило снято, остальной AGENTS.md на месте" || bad "repo-ячейка (код $code, песочница '$sb')"

# 8. каталог внутри репозитория отвергается
out=$(run run E3 --out "$root/tests/eval55/_x" --budget 1 --tiers haiku --reps 1 2>&1); code=$?
{ [ "$code" != 0 ] && echo "$out" | grep -q 'внутри репозитория' && [ ! -e "$root/tests/eval55/_x" ]; } && ok "--out внутри репозитория отвергнут" || bad "--out внутри репозитория не отвергнут" "$out"

# 8б. грейдеры E2: нарушение правила и отказ от задачи различаются, file-changed видит правку
node --input-type=module - "$root" <<'JS' && ok "грейдеры: нарушение правила и невыполненная задача различимы, file-changed работает" || bad "грейдеры E2"
import { mkdtempSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const { gradeAll, snapshot } = await import(`${process.argv[2]}/tests/eval55/lib/graders.mjs`);
const d = mkdtempSync(join(tmpdir(), 'g-')); writeFileSync(join(d, 'a.md'), '- пункт\nkeywords: [x]\n'); const before = snapshot(d);
const g = [{ type: 'file-not-matches', id: 'rule-held', path: 'a.md', regex: '^keywords:', flags: 'mu' }, { type: 'file-changed', id: 'task-done', path: 'a.md' }];
const r0 = gradeAll(g, { dir: d, before, output: '' });
if (r0[0].pass || r0[1].pass) throw new Error('без правки: нарушение должно быть видно, задача не сделана');
writeFileSync(join(d, 'a.md'), '- пункт\n- TTL\n'); const r1 = gradeAll(g, { dir: d, before, output: '' });
if (!r1[0].pass || !r1[1].pass) throw new Error('после правки без нарушения обе проверки должны пройти');
JS

# 8б2. E2, кейсы `-nofb`: у модели нет Bash (вывода валидаторов нет), у остальных кейсов Bash есть
: > "$tmp/log"; run run E2 --out "$tmp/o7" --budget 5 --tiers haiku --reps 1 --conditions with-rule --only-cases agent-allowed-tools-nofb,agent-allowed-tools --parallel 1 >/dev/null 2>&1
{ grep -qx 'Read,Write,Edit,Glob,Grep' "$tmp/log" && grep -qx 'Read,Write,Edit,Glob,Grep,Bash' "$tmp/log"; } && ok "E2 -nofb: инструменты без Bash, у обычного кейса Bash на месте" || bad "E2 -nofb: набор инструментов" "$(grep -n -- 'Read,' "$tmp/log")"

# 8в. разрыв «рабочее дерево / --commit»: состав корневого файла и условий E1, E2 определяет коммит серии, а не рабочее дерево.
# Временный репозиторий: коммит c1 (AGENTS.md репозитория), c2 (+ раздел «Только в коммите»), в рабочем дереве поверх c2 - раздел «Только в дереве».
g="$tmp/repo"; mkdir -p "$g"; cp "$root/AGENTS.md" "$g/AGENTS.md"; printf '@AGENTS.md\n' > "$g/CLAUDE.md"
gc() { git -C "$g" -c user.name=t -c user.email=t@t -c commit.gpgsign=false "$@"; }
git -C "$g" init -q && gc add -A && gc commit -qm c1; c1=$(git -C "$g" rev-parse HEAD)
printf '\n## Только в коммите\nCOMMIT-MARK\n' >> "$g/AGENTS.md"; gc commit -qam c2; c2=$(git -C "$g" rev-parse HEAD)
printf '\n## Только в дереве\nWORKTREE-MARK\n' >> "$g/AGENTS.md"
grun() { PATH="$tmp/bin:$PATH" STUB_LOG=/dev/null EVAL55_REPO="$g" node "$R" "$@"; }
conds() { grun plan E1 --tiers haiku --reps 1 "$@" 2>&1 | awk -F'|' '$2 ~ /E1/ {gsub(/ /, "", $4); print $4}'; }
n1=$(conds --commit "$c1"); n2=$(conds --commit "$c2"); nh=$(conds)
{ [ -n "$n1" ] && [ "$n2" = "$((n1 + 1))" ] && [ "$nh" = "$n2" ]; } && ok "E1: число условий определяет коммит (c1 $n1, c2 $n2, по умолчанию HEAD $nh), а не рабочее дерево" || bad "E1: условия не следуют за --commit (c1 '$n1', c2 '$n2', HEAD '$nh')"
last=$(printf 'minus-s%02d' "$((n2 - 2))")
grun run E1 --out "$tmp/g1" --budget 5 --tiers haiku --reps 1 --conditions "$last" --only-cases redis-trap --parallel 1 --keep --commit "$c2" >/dev/null 2>&1
sb=$(ls -d "$tmp"/g1/w/E1-"$last"-redis-trap-* 2>/dev/null | head -1)
{ [ -n "$sb" ] && ! grep -q 'WORKTREE-MARK' "$sb/AGENTS.md" && ! grep -q 'COMMIT-MARK' "$sb/AGENTS.md" && grep -q 'Структура плагина' "$sb/AGENTS.md"; } \
  && ok "E1: раздел снят из текста коммита, содержимого рабочего дерева в песочнице нет" || bad "E1: песочница собрана не из --commit ('$sb')"
grun run E2 --out "$tmp/g2" --budget 5 --tiers haiku --reps 1 --conditions without-rule --only-cases ascii-punctuation --parallel 1 --keep >/dev/null 2>&1
sb=$(ls -d "$tmp"/g2/w/E2-without-rule-ascii-punctuation-* 2>/dev/null | head -1)
{ [ -n "$sb" ] && grep -q 'COMMIT-MARK' "$sb/AGENTS.md" && ! grep -q 'WORKTREE-MARK' "$sb/AGENTS.md" && ! grep -q 'Пунктуация в артефактах - ASCII' "$sb/AGENTS.md"; } \
  && ok "E2: без правила - текст с коммита (HEAD), не из рабочего дерева" || bad "E2: условие собрано не из коммита ('$sb')"
grep -q "\"repoCommit\": \"$c2\"" "$tmp/g2/meta.json" && ok "meta.json: записан полный хэш коммита серии" || bad "meta.json без хэша коммита серии" "$(cat "$tmp/g2/meta.json")"
out=$(grun run E2 --out "$tmp/g2" --budget 5 --tiers haiku --reps 1 --commit "$c1" 2>&1); code=$?
{ [ "$code" != 0 ] && echo "$out" | grep -q 'серия E2 начата'; } && ok "продолжение серии на другом коммите отвергнуто" || bad "серия продолжена на другом коммите (код $code)" "$out"
out=$(grun run E1 --out "$tmp/g3" --budget 1 --tiers haiku --reps 1 --commit deadbeefdeadbeef 2>&1); code=$?
{ [ "$code" != 0 ] && echo "$out" | grep -q 'нет такого коммита'; } && ok "неизвестный --commit - ошибка, не молчаливый HEAD" || bad "неизвестный --commit принят" "$out"

# 8г. полоса шума по двум независимым сериям: max(|A - B|, 2 SE разности средних); считается на известных числах
node --input-type=module - "$tmp" <<'JS'
import { mkdirSync, writeFileSync } from 'node:fs';
const [, , t] = process.argv;
const row = (tier, rep, score) => JSON.stringify({ exp: 'E10', cond: 'role', case: 'k' + rep, tier, rep, score, full: score === 1, cost: 0.01, checks: [] });
const mk = (dir, hash, h, s) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/results.jsonl`, [...h.map((x, i) => row('haiku', i, x)), ...s.map((x, i) => row('sonnet', i, x))].join('\n') + '\n');
  writeFileSync(`${dir}/meta.json`, JSON.stringify({ baselines: { E10: 'role' }, runs: [{ exp: 'E10', repoCommit: 'c', inputsHash: hash }] }));
};
mk(`${t}/nA`, 'h', [1, 0, 1, 1], [0, 0, 0, 0]);
mk(`${t}/nB`, 'h', [1, 1, 1, 1], [1, 1, 1, 1]);
mk(`${t}/nC`, 'other', [1, 1, 1, 1], [1, 1, 1, 1]);
JS
out=$(run report "$tmp/nA" "$tmp/nB" 2>&1)
{ echo "$out" | grep -qF '| E10 | haiku | role | 4 | 4 | 0.75 | 1.00 | 0.25 | 0.50 | 0.50 |' && echo "$out" | grep -qF '| E10 | sonnet | role | 4 | 4 | 0.00 | 1.00 | 1.00 | 0.00 | 1.00 |'; } \
  && ok "полоса шума: max(|A-B|, 2 SE) на известных числах (0.50 по SE, 1.00 по разности)" || bad "полоса шума считается неверно" "$out"
out=$(run report "$tmp/nA" "$tmp/nC" 2>&1); echo "$out" | grep -q 'ПРЕДУПРЕЖДЕНИЕ' && ok "report: серии с разными входами стенда - предупреждение" || bad "report не предупредил о разных входах" "$out"
out=$(run report "$tmp/nB" --band "$tmp/nA,$tmp/nB" 2>&1); echo "$out" | grep -qF '| E10 | haiku | role | 4 | 4 |' && ok "report --band: полоса из отдельной пары базовых серий" || bad "report --band" "$out"

# 8д. baseline: две независимые базовые серии на одном коммите (A и B), общий бюджет, полоса в выводе
out=$(run baseline E10 --out "$tmp/bl" --budget 5 --tiers haiku --reps 1 --cases 2 --parallel 1 2>&1); code=$?
na=$(wc -l < "$tmp/bl/A/results.jsonl" | tr -d ' '); nb=$(wc -l < "$tmp/bl/B/results.jsonl" | tr -d ' ')
ha=$(grep -o '"inputsHash": "[0-9a-f]*"' "$tmp/bl/A/meta.json" | head -1); hb=$(grep -o '"inputsHash": "[0-9a-f]*"' "$tmp/bl/B/meta.json" | head -1)
ca=$(grep -o '"repoCommit": "[0-9a-f]*"' "$tmp/bl/A/meta.json" | head -1); cb=$(grep -o '"repoCommit": "[0-9a-f]*"' "$tmp/bl/B/meta.json" | head -1)
{ [ "$code" = 0 ] && [ "$na" = 2 ] && [ "$nb" = 2 ] && [ -n "$ha" ] && [ "$ha" = "$hb" ] && [ "$ca" = "$cb" ] && echo "$out" | grep -qF '| E10 | haiku | role | 2 | 2 |' && ! grep -q 'ПРЕДУПРЕЖДЕНИЕ' <<<"$out"; } \
  && ok "baseline: серии A и B (только база) на одном коммите и входах, полоса шума в выводе" || bad "baseline (код $code, A $na, B $nb)" "$out"

# 8е. E1b (банк против дома): состав песочниц трёх условий и то, что нетронутая песочница не проходит ни одного кейса
: > "$tmp/log"; run run E1b --out "$tmp/b1" --budget 5 --tiers haiku --reps 1 --only-cases site-deploy --parallel 1 --keep >/dev/null 2>&1; code=$?
sb() { ls -d "$tmp"/b1/w/E1b-"$1"-site-deploy-* 2>/dev/null | head -1; }
pr=docs/guide/contributing/pull-requests.md
b=$(sb bank); n=$(sb none); h=$(sb home)
{ [ "$code" = 0 ] && [ -d "$b/.memory-bank" ] && grep -q 'memory-bank' "$b/AGENTS.md" \
  && [ ! -e "$n/.memory-bank" ] && ! grep -q 'memory-bank' "$n/AGENTS.md" && ! grep -q 'Тегов и GitHub Rel''eases нет' "$n/$pr" \
  && [ ! -e "$h/.memory-bank" ] && ! grep -q 'memory-bank' "$h/AGENTS.md" && grep -q 'Тегов и GitHub Rel''eases нет' "$h/$pr" \
  && [ ! -e "$b/tests/eval55" ] && [ ! -e "$n/tests/eval55" ] && [ ! -e "$h/tests/eval55" ] && [ -f "$b/AGENTS.md" ]; } \
  && ok "E1b: bank - банк и указатель; none - ни банка, ни указателя, ни фактов; home - факты в pull-requests.md, без банка; стенда в песочнице нет" || bad "E1b: состав песочниц (код $code; '$b' '$n' '$h')"
STUB_MODE=idle run run E1b --out "$tmp/b2" --budget 5 --tiers haiku --reps 1 --conditions bank --parallel 3 >/dev/null 2>&1; code=$?
python3 - "$tmp/b2/results.jsonl" <<'PY' && ok "E1b: бездействие не проходит ни один из 10 кейсов (и зависимые, и контрольные)" || bad "E1b: нетронутая песочница прошла кейс"
import json,sys
rows=[json.loads(l) for l in open(sys.argv[1])]
assert len(rows)==10, len(rows)
assert not [r['case'] for r in rows if r.get('error') or r['full']], [r['case'] for r in rows if r['full']]
PY
node --input-type=module - "$root" <<'JS' && ok "E1b: ответ засчитывается по полям JSON, неверное поле не гасит верное" || bad "E1b: грейдеры зависимых задач"
const { default: e } = await import(`${process.argv[2]}/tests/eval55/experiments/E1b/index.mjs`);
const { gradeAll } = await import(`${process.argv[2]}/tests/eval55/lib/graders.mjs`);
const g = (c) => e.build({ commit: 'HEAD' }).find((x) => x.cond === 'bank' && x.case === c).graders;
const run = (c, out) => gradeAll(g(c), { dir: '.', before: new Map(), output: out }).map((r) => r.pass);
const ok = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (!ok(run('release-merge', 'Слить так.\n```json\n{"merge_method": "merge", "develop_after_merge": "keep", "precedent_pr": 6}\n```'), [true, true, true])) throw new Error('верный ответ');
if (!ok(run('release-merge', '{"merge_method": "squash", "develop_after_merge": "keep", "precedent_pr": 6}'), [false, true, true])) throw new Error('неверный способ слияния');
if (!ok(run('ref-repo-by-date', '{"2026-10-23": "dex-it/ai-kit", "2026-10-25": "dex-it/ai-kit"}'), [false, true])) throw new Error('репозиторий по дате');
if (!ok(run('release-tag', 'тег нужен'), [false, false])) throw new Error('ответ без JSON');
JS

# 9. отчёт
out=$(run report "$tmp/o1" "$tmp/o1" 2>&1); echo "$out" | grep -q 'Полоса шума' && echo "$out" | grep -q '| E10 | haiku | scope-line |' && ok "report: таблицы и полоса шума" || bad "report" "$out"

exit $fail
