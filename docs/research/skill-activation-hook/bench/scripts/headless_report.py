"""Какие скилы открыли прогоны claude -p: headless_report.py <каталог прогонов> [префикс id]"""
import glob
import json
import os
import sys

runs_dir = sys.argv[1]
prefix = sys.argv[2] if len(sys.argv) > 2 else ''
for out in sorted(glob.glob(f'{runs_dir}/{prefix}*/out.jsonl')):
    run_id = os.path.basename(os.path.dirname(out))
    skills, listed, result = [], 0, ''
    has_result, is_error = False, False
    exit_file = os.path.join(os.path.dirname(out), 'exit.txt')
    bad_exit = os.path.isfile(exit_file) and open(exit_file).read().strip() != '0'
    for line in open(out, encoding='utf-8'):
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get('type') == 'system' and event.get('subtype') == 'init':
            listed = sum('claude-rules' in name for name in event.get('skills', []))
        if event.get('type') == 'result':
            has_result, is_error = True, bool(event.get('is_error'))
            result = f"{event.get('num_turns')} ходов, ${event.get('total_cost_usd', 0):.3f}"
        message = event.get('message')
        if not isinstance(message, dict):
            continue
        for part in message.get('content') or []:
            if isinstance(part, dict) and part.get('type') == 'tool_use' and part.get('name') == 'Skill':
                skills.append(part['input'].get('skill', '').split(':')[-1].replace('claude-rules-', ''))
    if bad_exit or is_error or not has_result:
        print(f'{run_id}\tошибка\t{result}'.rstrip())
        continue
    print(f'{run_id}\tскилов кита в списке: {listed}\t{", ".join(dict.fromkeys(skills)) or "-"}\t{result}')
