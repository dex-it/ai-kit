// Детерминированные грейдеры стенда eval55. Грейдер возвращает список проверок {id, pass}: ячейка оценивается долей
// пройденных проверок (покомпонентно) и признаком «все пройдены» (полное соблюдение). LLM-судьи здесь нет: судья - отдельный
// слепой проход с перестановками, его завод - в протоколе эксперимента, не в раннере.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export function snapshot(dir) {
  const out = new Map();
  const walk = (d, base = '') => {
    for (const e of readdirSync(d).sort()) {
      if (e === 'node_modules' || e === '.git') continue;
      const p = join(d, e);
      const rel = base ? `${base}/${e}` : e;
      const st = statSync(p);
      if (st.isDirectory()) walk(p, rel);
      else out.set(rel, createHash('sha1').update(readFileSync(p)).digest('hex'));
    }
  };
  walk(dir);
  return out;
}

const changedSince = (before, now) => {
  const ch = [];
  for (const [k, v] of now) if (before.get(k) !== v) ch.push(k);
  for (const k of before.keys()) if (!now.has(k)) ch.push(k);
  return ch.sort();
};

const toRe = (g) => new RegExp(g.regex, g.flags ?? 'u');

// Последний JSON-объект ответа: в блоке ```json либо от первой `{` до последней `}`.
export function lastJson(text) {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const c of [...fenced.reverse(), text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)]) {
    try { const v = JSON.parse(c); if (v && typeof v === 'object') return v; } catch { /* следующий кандидат */ }
  }
  return null;
}

/** ctx: { dir, before: Map, output: string } */
export function grade(g, ctx) {
  const id = g.id ?? g.type;
  const one = (pass, detail) => [{ id, pass: !!pass, ...(detail ? { detail } : {}) }];
  switch (g.type) {
    case 'output-matches': return one(toRe(g).test(ctx.output));
    case 'output-not-matches': return one(!toRe(g).test(ctx.output));
    case 'output-equals': return one(ctx.output.trim().replace(/^[`"'\s]+|[`"'\s.]+$/g, '') === g.value);
    case 'output-not-equals': return one(ctx.output.trim().replace(/^[`"'\s]+|[`"'\s.]+$/g, '') !== g.value);
    case 'file-exists': return one(existsSync(join(ctx.dir, g.path)));
    case 'file-matches': return one(existsSync(join(ctx.dir, g.path)) && toRe(g).test(readFileSync(join(ctx.dir, g.path), 'utf8')));
    case 'file-not-matches': return one(!existsSync(join(ctx.dir, g.path)) || !toRe(g).test(readFileSync(join(ctx.dir, g.path), 'utf8')));
    case 'file-unchanged': return one(ctx.before.get(g.path) === snapshot(ctx.dir).get(g.path));
    case 'file-changed': return one(ctx.before.get(g.path) !== snapshot(ctx.dir).get(g.path));
    case 'nothing-changed': { const ch = changedSince(ctx.before, snapshot(ctx.dir)); return one(ch.length === 0, ch.join(', ')); }
    case 'only-changed': {
      const ch = changedSince(ctx.before, snapshot(ctx.dir)).filter((f) => !g.allowed.some((a) => f === a || f.startsWith(a.endsWith('/') ? a : `${a}/`)));
      return one(ch.length === 0, ch.join(', '));
    }
    case 'cmd': {
      const r = spawnSync(g.run[0], g.run.slice(1), { cwd: ctx.dir, encoding: 'utf8', timeout: g.timeoutMs ?? 120000 });
      return one(r.status === (g.exitCode ?? 0), r.status === (g.exitCode ?? 0) ? undefined : `exit ${r.status}`);
    }
    case 'json-fields': { // по проверке на поле ответа: покомпонентное соблюдение видно в доле
      const obj = lastJson(ctx.output);
      return Object.entries(g.fields).map(([k, v]) => ({ id: `${id}:${k}`, pass: !!obj && obj[k] === v }));
    }
    default: throw new Error(`неизвестный грейдер: ${g.type}`);
  }
}

export function gradeAll(graders, ctx) {
  return graders.flatMap((g) => grade(g, ctx));
}
