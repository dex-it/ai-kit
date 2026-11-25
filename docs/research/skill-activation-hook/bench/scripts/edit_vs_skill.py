import glob, json, os, re, time, collections
since = time.time() - 30*86400
rules = [  # (что правили, регулярка пути, нужный скил)
    ('.cs', re.compile(r'\.cs$'), ['csharp-code', 'upcore-code']),
    ('фронт upcore', re.compile(r'upcore[^/]*front.*\.(ts|tsx)$'), ['upcore-frontend']),
    ('любой код', re.compile(r'\.(cs|ts|tsx|js|py)$'), ['code-writing']),
]
stats = collections.defaultdict(lambda: [0, collections.Counter()])
for f in glob.glob(os.path.expanduser('~/.claude/projects/') + '*/*.jsonl') + glob.glob(os.path.expanduser('~/.claude/projects/') + '*/*/subagents/*.jsonl'):
    if os.path.getmtime(f) < since: continue
    edited, skills = set(), set()
    for line in open(f, errors='ignore'):
        if '"tool_use"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        for c in (d.get('message') or {}).get('content') or []:
            if not isinstance(c, dict) or c.get('type') != 'tool_use': continue
            i = c.get('input') or {}
            if c.get('name') in ('Edit', 'Write', 'MultiEdit'): edited.add(i.get('file_path', ''))
            if c.get('name') == 'Skill': skills.add(i.get('skill', '').split(':')[-1].replace('claude-rules-', ''))
    for name, rx, need in rules:
        if any(rx.search(p) for p in edited):
            stats[name][0] += 1
            for s in need: stats[name][1][s] += s in skills
            stats[name][1]['ни одного скила'] += not skills
for name, (n, c) in stats.items():
    print(f'{name}: сессий с правкой {n};', ', '.join(f'{k} открыт в {v}' for k, v in c.items()))
