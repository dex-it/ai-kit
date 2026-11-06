# Сборка вариантов контракта в $NC_RUN_DIR/variants/<имя>/plugins/skills/dex-skill-node-contract:
#   base  - редакция из NC_BASE (по умолчанию origin/develop);
#   cur   - рабочее дерево;
#   rt    - из base строки словаря полей ревью и покрытия тестами уходят в references/field-vocabulary.md;
#   marks - то же для строк метки: quality-checks, pending-judgement, self-check, revoke, approve.
# Группы rt и marks строятся от base, а не от cur: после переноса строк метки (cur) они в SKILL.md уже не стоят.
# В варианте строки из SKILL.md убираются, в таблицу «Материалы по требованию» встаёт строка условия.
import shutil, os, re, subprocess
S = os.environ['NC_RUN_DIR']
W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
BASE = os.environ.get('NC_BASE', 'origin/develop')
PL = 'plugins/skills/dex-skill-node-contract'
SK = PL + '/skills/node-contract/SKILL.md'
ANCHOR = "| читаешь или пишешь MR/PR на хостинге (метаданные, diff, треды) | `references/hosting-channel.md` |"
HDR = ("# Поля, вынесенные из словаря\n\nМатериал `node-contract` по требованию; условие чтения - таблица «Материалы по требованию» в\n"
       "`SKILL.md`. Поля сверяются по смыслу, не по имени (правило словаря полей в `SKILL.md`).\n\n| Поле | Смысл | Синонимы источника |\n|---|---|---|\n")
GROUPS = {
    'rt': (['red-run', 'uncovered-status', 'uncovered', 'block', 'origin', 'review-verdict'],
           "заполняешь или читаешь поля ревью изменения (`block`, `origin`, `review-verdict`) либо покрытия тестами (`red-run`, `uncovered-status`, `uncovered`)"),
    'marks': (['quality-checks', 'pending-judgement', 'self-check', 'revoke', 'approve'],
              "заполняешь или читаешь поля метки и самопроверки (`quality-checks`, `pending-judgement`, `self-check`, `approve`, `revoke`)"),
}

def fresh(name):
    d = f'{S}/variants/{name}'
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    return d

d = fresh('base')
subprocess.run(f'cd {W} && git archive {BASE} {PL} | tar -x -C {d}', shell=True, check=True)
d = fresh('cur')
shutil.copytree(f'{W}/{PL}', f'{d}/{PL}')
for name, (fields, cond) in GROUPS.items():
    d = fresh(name)
    subprocess.run(f'cd {W} && git archive {BASE} {PL} | tar -x -C {d}', shell=True, check=True)
    p = f'{d}/{SK}'
    keep, rows = [], []
    for l in open(p, encoding='utf8').read().split('\n'):
        m = re.match(r'\| `([^`]+)` \|', l)
        (rows if m and m.group(1) in fields else keep).append(l)
    assert len(rows) == len(fields), (name, len(rows))
    t = '\n'.join(keep)
    assert ANCHOR in t
    t = t.replace(ANCHOR, ANCHOR + f"\n| {cond} | `references/field-vocabulary.md` |")
    open(p, 'w', encoding='utf8').write(t)
    open(f'{d}/{PL}/skills/node-contract/references/field-vocabulary.md', 'w', encoding='utf8').write(HDR + '\n'.join(rows) + '\n')
print({n: os.path.getsize(f'{S}/variants/{n}/{SK}') for n in ['base', 'cur', 'rt', 'marks']})
