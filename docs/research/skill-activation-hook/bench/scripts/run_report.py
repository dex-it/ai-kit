"""Какие скилы открыли сабагенты прогона.

run_report.py <каталог транскриптов сабагентов> [метка каталога прогонов]
Прогон узнаётся по пути копии песочницы в первом сообщении сабагента: .../runs/<id>/cart.
"""
import glob
import json
import re
import sys

RUN_PATH = re.compile(r'/runs/([\w-]+)/cart')

def first_user_text(lines):
    for line in lines:
        record = json.loads(line)
        if record.get('type') != 'user':
            continue
        content = record['message']['content']
        if isinstance(content, str):
            return content
        return ' '.join(part.get('text', '') for part in content if isinstance(part, dict))
    return ''

def skills_called(lines):
    called = []
    for line in lines:
        for name in re.findall(r'"name":"Skill","input":\{"skill":"([^"]+)"', line):
            called.append(name.split(':')[-1].replace('claude-rules-', ''))
    return called

rows = []
for path in glob.glob(f'{sys.argv[1]}/*.jsonl'):
    lines = open(path, encoding='utf-8').readlines()
    match = RUN_PATH.search(first_user_text(lines))
    if match and (len(sys.argv) < 3 or sys.argv[2] in first_user_text(lines)):
        rows.append((match.group(1), skills_called(lines)))
for run_id, called in sorted(rows):
    print(f'{run_id}\t{", ".join(dict.fromkeys(called)) or "-"}')
