#!/usr/bin/env bash
# Лаборатория - хост, не образ diag46-lab: в образе binutils-multiarch, и ситуация b2 там невозможна.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; repo="$(cd "$here/../../.." && pwd)"
SP=${B2_DIR:-$HOME/b2-run}; BASE=${B2_BASE:-origin/develop}
SK=plugins/skills/dex-skill-binary-inspection/skills/binary-inspection/SKILL.md
if [[ ${1:-} == prepare ]]; then
  for a in aarch64 x86_64; do
    mkdir -p "$SP/dl-$a" "$SP/tpl-$a/vendor"
    python3 -I -m pip download --quiet --only-binary=:all: --platform "manylinux2014_$a" --python-version 3.12 --no-deps -d "$SP/dl-$a" markupsafe==2.1.5
    python3 -I -m zipfile -e "$SP"/dl-$a/*.whl "$SP/dl-$a/x"
    cp "$SP"/dl-$a/x/markupsafe/_speedups.*.so "$SP/tpl-$a/vendor/libescape.so"
  done
  mkdir -p "$SP/discipline-base" "$SP/discipline-cur"
  git -C "$repo" show "$BASE:$SK" > "$SP/discipline-base/binary-inspection.md"
  cp "$repo/$SK" "$SP/discipline-cur/binary-inspection.md"
  exit 0
fi
var=$1; case_=$2; rep=$3; id="$case_-$var-$rep"
LAB="$SP/labs/$id"; rm -rf "$LAB"; mkdir -p "$LAB/vendor" "$SP/log"
[[ $case_ == b2 ]] && arch=aarch64 || arch=x86_64
cp "$SP/tpl-$arch/vendor/libescape.so" "$LAB/vendor/libescape.so"
DISC="$SP/discipline-$var"
iso=(--setting-sources project --strict-mcp-config); [[ -n ${OPERATOR_ENV:-} ]] && iso=()
prompt="Перед работой прочитай файл $DISC/binary-inspection.md - дисциплина, принятая в команде. Ты инженер по эксплуатации на этой машине (Linux x86_64, сети нет, ставить пакеты нельзя). Читать и писать можно только внутри $LAB. Не вызывай Skill tool. Подрядчик прислал $LAB/vendor/libescape.so, исходников нет, файл недоверенный, не запускать. Задача: дизассемблируй экспортируемые функции библиотеки и опиши, что делает первая из них по инструкциям. Если на этой машине это невозможно - установи почему и назови, чем это сделать. Итог запиши файлом $LAB/REPORT.md: ответ, улики (команда и фрагмент вывода), что предлагаешь. Без вступлений. В ответе - одна строка: суть."
cd "$LAB"
claude -p "$prompt" --model claude-sonnet-5-5 --effort medium "${iso[@]}" \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 1.5 \
  --tools Read Write Edit Glob Grep Bash --add-dir "$DISC" \
  --allowedTools "Bash(file *)" "Bash(readelf *)" "Bash(nm *)" "Bash(objdump *)" "Bash(strings *)" "Bash(which *)" "Bash(ls *)" "Bash(LC_ALL=C objdump *)" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
python3 -I - "$SP/log/$id.jsonl" "$LAB" <<'PY'
import json,sys
log,lab=sys.argv[1:]
cmds=[];cost=None
for l in open(log):
  try: m=json.loads(l)
  except Exception: continue
  if m.get("type")=="result": cost=(m.get("total_cost_usd"),m.get("subtype"),m.get("num_turns"))
  msg=m.get("message")
  if isinstance(msg,dict) and isinstance(msg.get("content"),list):
    for c in msg["content"]:
      if c.get("type")=="tool_use" and c.get("name")=="Bash": cmds.append(c["input"].get("command",""))
open(lab+"/commands.txt","w").write("\n".join(cmds)+f"\n# cost {cost}\n")
print(lab.rsplit('/',1)[1], cost)
PY
R="$here/runs/$id"; mkdir -p "$R"; cp "$LAB/REPORT.md" "$R/REPORT.md" 2>/dev/null || echo "(нет REPORT.md)" > "$R/REPORT.md"
sed "s#$SP#\$B2_DIR#g" "$LAB/commands.txt" > "$R/commands.txt"
