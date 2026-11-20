import glob, json, os, re, time, collections
since = time.time() - 30*86400
listed, loaded = collections.Counter(), collections.Counter()
for f in glob.glob(os.path.expanduser('~/.claude/projects/') + '*/*.jsonl'):
    if os.path.getmtime(f) < since: continue
    names, used = set(), set()
    for line in open(f, errors='ignore'):
        if 'skill_listing' in line:
            try: a = json.loads(line).get('attachment') or {}
            except Exception: continue
            for m in re.finditer(r'^- ([\w-]+:claude-rules-[\w-]+)', a.get('content', ''), re.M): names.add(m.group(1).split(':')[1])
        for m in re.finditer(r'"skill":"([^"]+)"', line): used.add(m.group(1).split(':')[-1])
    for n in names:
        listed[n] += 1; loaded[n] += n in used
for n, c in sorted(listed.items(), key=lambda x: -loaded[x[0]]/x[1]):
    print(f'{loaded[n]:3}/{c:<3} {n.replace("claude-rules-","")}')
