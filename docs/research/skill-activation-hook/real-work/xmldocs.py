"""Сессии бэкенда upcore с правкой .cs: писали ли Edit/Write строки `///` и открыт ли csharp-xml-docs. Запуск: python3 xmldocs.py <копия db>"""
import json, sqlite3, subprocess, sys, os, collections, datetime as dt
TRACES = os.path.expanduser("~/.switchyard/traces")
def day(iso): return (dt.datetime.fromisoformat(iso.replace("Z", "+00:00")) + dt.timedelta(hours=2)).date().isoformat()
def wrote_xml(sid, sources):
    hit = False
    for src in json.loads(sources or "[]"):
        path = os.path.join(TRACES, sid, src.get("file") or "")
        if not os.path.isfile(path): return None
        raw = subprocess.run(["zstd", "-dc", path], capture_output=True).stdout.decode("utf-8", "replace")
        for line in raw.splitlines():
            if '"tool_use"' not in line or "///" not in line: continue
            try: msg = json.loads(line)
            except ValueError: continue
            for part in (msg.get("message") or {}).get("content") or []:
                if not isinstance(part, dict) or part.get("type") != "tool_use" or part.get("name") not in ("Edit", "Write", "MultiEdit"): continue
                inp = part.get("input") or {}
                if not str(inp.get("file_path", "")).endswith(".cs"): continue
                written = (inp.get("new_string") or "") + (inp.get("old_string") or "") + (inp.get("content") or "") + "".join(e.get("new_string", "") + e.get("old_string", "") for e in inp.get("edits") or [])
                if "///" in written: hit = True  # писали новый или правили старый XML-комментарий
    return hit
def main():
    db = sqlite3.connect(sys.argv[1])
    res = collections.defaultdict(collections.Counter)
    for sid, first, sources in db.execute("""SELECT s.id, MIN(t.started_at), s.sources FROM trace_sessions s JOIN trace_turns t ON t.session_id = s.id
            WHERE s.kind='session' AND s.repo='upcore.backend' GROUP BY s.id"""):
        if not db.execute("SELECT 1 FROM trace_calls WHERE session_id=? AND tool IN ('Edit','Write','MultiEdit') AND target LIKE '%.cs' AND parent IS NULL LIMIT 1", (sid,)).fetchone(): continue
        p = "после" if day(first) >= "2026-11-17" else "до"
        opened = bool(db.execute("SELECT 1 FROM trace_calls WHERE session_id=? AND tool='Skill' AND parent IS NULL AND target LIKE '%csharp-xml-docs'", (sid,)).fetchone())
        w = wrote_xml(sid, sources)
        res[p][("нет архива" if w is None else "писали ///" if w else "без ///", "открыт" if opened else "не открыт")] += 1
    for p in ("до", "после"):
        print(p, dict(res[p]))


if __name__ == "__main__":
    main()
