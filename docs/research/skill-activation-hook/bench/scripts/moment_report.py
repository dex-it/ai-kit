"""Когда сабагент открыл скилы относительно первой правки кода и итогового ответа.

moment_report.py <каталог транскриптов сабагентов> [префикс id прогона]
Каталог: ~/.claude/projects/<папка сессии>/<id сессии>/subagents. Прогон узнаётся по пути копии
песочницы в первом сообщении: .../runs/<id>/cart.
Правка - Edit/Write/MultiEdit файла в src или test копии (путь любой, в том числе относительный после cd), либо Bash с записью в такой файл
(`>`, `sed -i`, `tee`). Итоговый ответ - вызов SubagentHandback или последний текст без вызова инструмента.
"""
import glob
import json
import re
import sys

RUN_PATH = re.compile(r'/runs/([\w-]+)/cart')
CODE_FILE = re.compile(r'(?:^|[\s/"\'])(?:src|test)/[\w.-]+\.js')
BASH_WRITE = re.compile(r'(>|sed -i|tee )')


def events(path):
    """(вид, имя) по порядку: ('skill', имя) | ('edit', файл) | ('answer', '')."""
    out, first_user, last_text = [], None, None
    for line in open(path, encoding='utf-8'):
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        message = record.get('message')
        if not isinstance(message, dict):
            continue
        content = message.get('content')
        if record.get('type') == 'user' and first_user is None:
            first_user = content if isinstance(content, str) else ' '.join(
                part.get('text', '') for part in content or [] if isinstance(part, dict))
        if record.get('type') != 'assistant':
            continue
        for part in content or []:
            if not isinstance(part, dict):
                continue
            if part.get('type') == 'text' and part.get('text', '').strip():
                last_text = len(out)
            if part.get('type') != 'tool_use':
                continue
            name, inp = part.get('name'), part.get('input') or {}
            if name == 'Skill':
                out.append(('skill', str(inp.get('skill', '')).split(':')[-1].replace('claude-rules-', '')))
            elif name in ('Edit', 'Write', 'MultiEdit') and CODE_FILE.search(str(inp.get('file_path', ''))):
                out.append(('edit', inp['file_path'].rsplit('/', 1)[-1]))
            elif name == 'Bash' and CODE_FILE.search(inp.get('command', '')) and BASH_WRITE.search(inp.get('command', '')):
                out.append(('edit', 'bash'))
            elif name == 'SubagentHandback':
                out.append(('answer', ''))
    if not any(kind == 'answer' for kind, _ in out) and last_text is not None:
        out.insert(last_text, ('answer', ''))
    return first_user or '', out


def main():
    prefix = sys.argv[2] if len(sys.argv) > 2 else ''
    rows = []
    for path in glob.glob(f'{sys.argv[1]}/*.jsonl'):
        first, seq = events(path)
        match = RUN_PATH.search(first)
        if not match or not match.group(1).startswith(prefix):
            continue
        edit = next((i for i, (k, _) in enumerate(seq) if k == 'edit'), None)
        answer = next((i for i, (k, _) in enumerate(seq) if k == 'answer'), None)
        before_edit = [n for i, (k, n) in enumerate(seq) if k == 'skill' and (edit is None or i < edit)]
        later = [n for i, (k, n) in enumerate(seq) if k == 'skill' and edit is not None and i > edit
                 and (answer is None or i < answer)]
        rows.append((match.group(1), before_edit, later, edit is not None, answer is not None))
    print('прогон\tдо первой правки\tпосле правки, до ответа\tправил\tответ')
    for run_id, before_edit, later, edited, answered in sorted(rows):
        print(f'{run_id}\t{", ".join(before_edit) or "-"}\t{", ".join(later) or "-"}\t'
              f'{"да" if edited else "нет"}\t{"да" if answered else "НЕТ"}')


if __name__ == '__main__':
    main()
