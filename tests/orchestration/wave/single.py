#!/usr/bin/env python3
"""Плечо «одна сессия»: те же ТЗ одной сессией без dex-auto.

    python3 -I single.py <репо> --out <файл.json> [--model opus] [--budget 12]
"""
import argparse, json, os, subprocess, time

ap = argparse.ArgumentParser()
ap.add_argument('repo'); ap.add_argument('--out', required=True)
ap.add_argument('--model', default='opus'); ap.add_argument('--budget', type=float, default=12)
a = ap.parse_args()
prompt = ('Выполни все четыре добавления из TASK.md в этом репозитории. По завершении закоммить локально, push не делать.')
t0 = time.time()
r = subprocess.run(['claude', '-p', '--model', a.model, '--dangerously-skip-permissions', '--output-format', 'json',
                    '--max-budget-usd', str(a.budget), prompt], cwd=a.repo, text=True, capture_output=True, timeout=60 * 60,
                   env={k: v for k, v in os.environ.items() if k != 'CLAUDECODE'})
try:
    data = json.loads(r.stdout)
except ValueError:
    data = {'result': r.stdout[-2000:], 'parse_error': True}
data['_wall_s'] = round(time.time() - t0, 1)
json.dump(data, open(a.out, 'w'), ensure_ascii=False, indent=1)
print(json.dumps({'cost_usd': data.get('total_cost_usd'), 'wall_s': data['_wall_s'], 'turns': data.get('num_turns')}))
