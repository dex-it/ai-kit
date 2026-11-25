"""Проверка прогонов стенда: ошибки API и закончился ли ответ ассистента.
check_runs.py [маска каталогов транскриптов claude -p] [каталог родительской сессии ...]
Прогоны claude -p - *.jsonl в каталогах по маске: ответ - финальный текст ассистента.
Сабагенты стенда запускались из обычных сессий - <родитель>/subagents/*.jsonl: ответ - последний вызов инструмента SubagentHandback.
Родители по умолчанию - две сессии 17.11 в ~/.claude/projects/-data-repositories-switchyard."""
import glob
import json
import os
import sys

mask = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '~/.claude/projects/*scratchpad-*runs*')
PARENTS = sys.argv[2:] or [
    '~/.claude/projects/-data-repositories-switchyard/d128c666-18d9-4140-8e84-5372c3427abc',
    '~/.claude/projects/-data-repositories-switchyard/b318b76b-8f27-43f3-b39e-07827c5afefb',
]


def check(path, handback=False):
    """(число ошибок API, закончился ли ответом ассистента): последняя запись user/assistant - assistant без вызова инструмента."""
    errors, last, events = 0, None, []
    for line in open(path, encoding='utf-8', errors='replace'):
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get('type') not in ('user', 'assistant'):
            continue
        events.append(event)
        if event.get('type') == 'assistant' and (event.get('isApiErrorMessage') or event.get('error')):
            errors += 1
        last = event
    answered = False
    if handback:
        calls = [p.get('name') for e in events if e.get('type') == 'assistant'
                 for p in (e.get('message') or {}).get('content') or [] if isinstance(p, dict) and p.get('type') == 'tool_use']
        return errors, bool(calls) and calls[-1] == 'SubagentHandback'
    if last and last.get('type') == 'assistant' and not last.get('isApiErrorMessage') and not last.get('error'):
        parts = (last.get('message') or {}).get('content') or []
        answered = any(isinstance(p, dict) and p.get('type') == 'text' and p.get('text', '').strip() for p in parts) \
            and not any(isinstance(p, dict) and p.get('type') == 'tool_use' for p in parts)
    return errors, answered


runs = sorted(glob.glob(f'{mask}/*.jsonl'))
dirs = {os.path.dirname(path) for path in runs}
bad = silent = 0
for path in runs:
    errors, answered = check(path)
    bad += errors > 0
    silent += not answered
    if errors or not answered:
        print(f'прогон\t{path}\tошибок API: {errors}\t{"с ответом" if answered else "без ответа"}')
print(f'прогонов (каталогов) {len(dirs)}, транскриптов {len(runs)}, с ошибкой: {bad}, без ответа: {silent}')

total = bad = silent = cart = cart_bad = cart_silent = 0
for parent in PARENTS:
    for path in sorted(glob.glob(os.path.join(os.path.expanduser(parent), 'subagents/*.jsonl'))):
        errors, answered = check(path, handback=True)
        first = next((json.loads(l) for l in open(path, encoding='utf-8', errors='replace') if '"type":"user"' in l), {})
        content = (first.get('message') or {}).get('content')
        about_cart = 'корзин' in (content if isinstance(content, str) else json.dumps(content, ensure_ascii=False))
        total += 1
        bad += errors > 0
        silent += not answered
        cart += about_cart
        cart_bad += about_cart and errors > 0
        cart_silent += about_cart and not answered
        if errors or not answered:
            print(f'сабагент\t{path}\tошибок API: {errors}\t{"с ответом" if answered else "без ответа"}')
print(f'сабагентов: {total}, с ошибкой: {bad}, без ответа: {silent}')
print(f'из них про корзину стенда: {cart}, с ошибкой: {cart_bad}, без ответа: {cart_silent}')
