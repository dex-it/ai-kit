#!/usr/bin/env bash
# Раннер захода S8 (#22): перепроверка с/без skill на Sonnet 5.5 для react (K2) и ts-nodejs-api (K1). Промпт поручения
# дословно как в группе 2.3 (ts-nodejs-api/README.md, «Промпт поручения»), флаги исполнителя те же, что в run-group-321.sh.
# run-s8.sh <case> <set> <idx> [skill-file]   case: k2 (SD-12, react, мины K2), k1 (SD-11, ts-nodejs-api, мины K1)
#   set: c - контроль без skill, s - со skill (SKILL.md текущей версии из plugins/). Выход - <skill>/runs/s8-<case>-<set><idx>/.
# Каталог прогонов - $S8_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${S8_WORK:?S8_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "S8_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
[[ -e $HOME/.claude/CLAUDE.md ]] && { echo "есть ~/.claude/CLAUDE.md"; exit 1; }
P="$T/_projects/shopdesk"
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
# Тир исполнителя: по умолчанию sonnet; RUN_TIER=haiku - claude-haiku-5-5, id прогона получает суффикс -haiku (добавлено в заходе S8, #22).
TIER="${RUN_TIER:-sonnet}"; TIER_SFX=""; [[ $TIER == sonnet ]] || TIER_SFX="-$TIER"
declare -A MODELS=([sonnet]=claude-sonnet-5-5 [haiku]=claude-haiku-5-5)
MODEL=${MODELS[$TIER]:?unknown tier $TIER}
declare -A SK=([k2]=react [k1]=ts-nodejs-api)
declare -A TASK=([k2]=docs/tasks/SD-12-order-search.md [k1]=docs/tasks/SD-11-order-payment.md)
declare -A MINES=([k2]=K2 [k1]=K1)
b=main; sk=${SK[$case_]:?unknown case $case_}; id="s8-$case_-$set_$idx${TIER_SFX}"
if [[ $set_ == c && ${#skills[@]} -gt 0 ]]; then echo "набор c - контроль, скилл не подаётся"; exit 1; fi
if [[ $set_ == s && ${#skills[@]} -eq 0 ]]; then echo "набор s требует skill-file"; exit 1; fi
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$W" "$SP/log" "$SP/tpl"
[[ -d $SP/tpl/$b ]] || bash "$P/setup.sh" "$SP/tpl/$b" "$b" >/dev/null 2>&1 || { echo "setup failed $b"; exit 1; }
DIR=$W/shopdesk
cp -cR "$SP/tpl/$b" "$DIR" || cp -R "$SP/tpl/$b" "$DIR"
[[ -f $SP/sandbox.json ]] || echo '{"sandbox":{"enabled":true,"autoAllowBashIfSandboxed":true,"allowUnsandboxedCommands":false,"network":{"allowLocalBinding":true,"allowedDomains":[]}}}' > "$SP/sandbox.json"
add=(); sline=""
if ((${#skills[@]})); then
  s="${skills[0]}"; mkdir -p "$W/rules/$sk"; cp "$s" "$W/rules/$sk/SKILL.md"
  add=(--add-dir "$W/rules"); sline="Перед работой прочитай $W/rules/$sk/SKILL.md - практики, принятые в команде.
"
fi
outside="${skills:+, кроме файлов практик выше}"
PROMPT="Ты TypeScript-разработчик (fullstack: Node.js API и React) в команде. Git-репозиторий проекта Shopdesk (монорепозиторий: api на Express, web на React, e2e) лежит в каталоге $DIR , текущая ветка - main.
${sline}Задача - ${TASK[$case_]}. Выполни её в рабочем дереве; коммитить не нужно.
Зависимости установлены (node_modules), внешней сети нет; доступны git, npm run typecheck, npm test, npx tsc, npx vitest, npx playwright (браузеры Playwright не установлены).
Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${outside}. В ответе - список изменённых файлов и 2-3 строки о решениях."
cd "$DIR"
claude -p "$PROMPT" --model "$MODEL" --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 1 --max-turns 150 \
  --settings "$SP/sandbox.json" --tools Read,Write,Edit,Glob,Grep,Bash --allowed-tools Read,Write,Edit,Glob,Grep,Bash "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
R=$T/$sk/runs/$id; rm -rf "$R"; mkdir -p "$R"
clean() { sed -e "s#$DIR#<run>#g" -e "s#$W#<work>#g" -e "s#$SP#<work>#g" -e "s#$REPO#<repo>#g" -e "s#$HOME#~#g"; }
printf '%s\n' "$PROMPT" | clean > "$R/prompt.txt"
git add -A -N . 2>/dev/null
git diff HEAD -- . ':(exclude)package-lock.json' | clean > "$R/diff.patch"
python3 - "$SP/log/$id.jsonl" > "$R/answer.md.raw" <<'PY'
import json,sys
r=""
for l in open(sys.argv[1]):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="result": r=m.get("result") or ""
print(r)
PY
clean < "$R/answer.md.raw" > "$R/answer.md"; rm -f "$R/answer.md.raw"
{
  echo "case=$case_"
  (cd "$DIR" && npm run typecheck >/dev/null 2>&1; echo "typecheck=$?")
  (cd "$DIR" && npm test >/dev/null 2>&1; echo "test=$?")
  bash "$P/mines/${MINES[$case_]}/run.sh" "$DIR"
} 2>&1 | clean > "$R/grade.txt"
python3 - "$SP/log/$id.jsonl" "$DIR" "$W/rules" "$REPO" > "$R/meta.json" <<'PY'
import json,sys
log,d,rules,repo=sys.argv[1:]
bad=set(); m_={"id":None}; skill=0; bash=[]
out={}
for l in open(log):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="system" and m.get("subtype")=="init":
    out.update(cli=m.get("claude_code_version"), model=m.get("model"), skills=m.get("skills"), mcp=m.get("mcp_servers"))
  if m.get("type")=="result":
    out.update(cost=m.get("total_cost_usd"), subtype=m.get("subtype"), turns=m.get("num_turns"), is_error=m.get("is_error"))
  msg=m.get("message")
  for c in (msg.get("content",[]) if isinstance(msg,dict) else []):
    if isinstance(c,dict) and c.get("type")=="tool_use":
      if c.get("name")=="Skill": skill+=1
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if p.startswith("/") and not (p.startswith(d) or p.startswith(rules)): bad.add(p)
      if c.get("name")=="Bash": bash.append(i.get("command","")[:160])
out.update(skill_tool_calls=skill, bash_calls=len(bash), reads_outside=sorted(bad))
print(json.dumps(out, ensure_ascii=False, indent=1))
PY
echo "$id $(python3 -c "import json;m=json.load(open('$R/meta.json'));print('model=%s cost=%s turns=%s sub=%s skillcalls=%s bash=%s outside=%s'%(m.get('model'),m.get('cost'),m.get('turns'),m.get('subtype'),m.get('skill_tool_calls'),m.get('bash_calls'),m.get('reads_outside')))")" | tee -a "$SP/log/summary.txt"
