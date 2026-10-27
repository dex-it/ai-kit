#!/usr/bin/env node
/**
 * Стенд замеров eval55: прогон экспериментов E1, E1b, E2, E3, E5, E7, E10 на тирах Claude 5.5.
 *
 *   node tests/eval55/run.mjs list
 *   node tests/eval55/run.mjs selftest                      # без платных вызовов: наборы строятся, грейдеры известны
 *   node tests/eval55/run.mjs hash                          # хэши входов (experiments/**, lib/**, priors.json) для раздела «Заморозка»
 *   node tests/eval55/run.mjs plan <E*|all|stage1|stage2> [опции]   # ячейки и оценка стоимости, вызовов нет; по умолчанию тиры Haiku и Sonnet
 *   node tests/eval55/run.mjs run <E*> --out <каталог> --budget <USD> [опции]
 *   node tests/eval55/run.mjs baseline <E*> --out <каталог> --budget <USD> [опции]   # две независимые базовые серии <out>/A, <out>/B на одном коммите + полоса шума
 *   node tests/eval55/run.mjs report <каталог> [<каталог-повтора-базы> | --band A,B]
 *
 * Опции: --tiers haiku,sonnet,opus  --reps 3  --conditions a,b  --cases N (первые N кейсов)  --only-cases a,b  --limit N (первые N ячеек)  --effort medium
 *        --cell-cap USD (потолок одного вызова, 2)  --parallel N (2)  --keep (не удалять песочницы)
 *        --commit REV (коммит серии, HEAD: из него собираются песочница repo-ячеек и состав условий E1, E2, E7; пишется в meta.json)
 *
 * Прогон платный и не входит в `npm test` / CI. Каталог --out обязан лежать вне репозитория: прогоны не засоряют дерево, а
 * CLAUDE.md и AGENTS.md репозитория не попадают в предков песочницы. Среду оператора раннер не пускает: --restricted (инструментов нет)
 * либо --setting-sources project (инструменты нужны) вместе с --strict-mcp-config; метод - tests/README.md, «Среда прогона раннеров».
 * Модель закреплена полным идентификатором и сверяется с modelUsage ответа; несовпадение - ошибка ячейки. Метод и решающие
 * правила - README.md и PREREG.md рядом.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, rmSync, cpSync, symlinkSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeAll, snapshot } from './lib/graders.mjs';
import { cellScore, summarize, paired, noise } from './lib/stats.mjs';
import { ROOT, resolveCommit } from './lib/repo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TIERS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const EXPERIMENTS = ['E1', 'E1b', 'E2', 'E3', 'E5', 'E7', 'E10'];
const GRADER_TYPES = ['output-matches', 'output-not-matches', 'output-equals', 'output-not-equals', 'file-exists', 'file-matches', 'file-not-matches', 'file-unchanged', 'file-changed', 'nothing-changed', 'only-changed', 'cmd', 'json-fields'];
const GIT_SANDBOX_ENV = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_PAGER: 'cat' };

function parseArgs(argv) {
  const pos = []; const opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      if (['keep'].includes(k)) opt[k] = true; else opt[k] = argv[++i];
    } else pos.push(argv[i]);
  }
  return { pos, opt };
}

async function load(id) { return (await import(`./experiments/${id}/index.mjs`)).default; }
const cellKey = (c, tier, rep) => `${c.exp}|${c.cond}|${c.case}|${tier}|${rep}`;

// Состав условий и кейсов строится из --commit (по умолчанию HEAD), а не из рабочего дерева: песочница repo-ячейки собирается из того же коммита.
async function cellsOf(id, opt) {
  const mod = await load(id);
  const commit = resolveCommit(opt.commit ?? 'HEAD');
  let cells = mod.build({ cases: opt.cases ? Number(opt.cases) : undefined, commit }).map((c) => ({ ...c, exp: id, kind: mod.kind }));
  if (opt.conditions) { const s = new Set(opt.conditions.split(',')); cells = cells.filter((c) => s.has(c.cond)); }
  if (opt['only-cases']) { const s = new Set(opt['only-cases'].split(',')); cells = cells.filter((c) => s.has(c.case)); }
  if (opt.cases) { const keep = new Set([...new Set(cells.map((c) => c.case))].slice(0, Number(opt.cases))); cells = cells.filter((c) => keep.has(c.case)); }
  return { mod, cells, commit };
}

// Стоимость ячейки E3 растёт с размером (вывод пропорционален числу обязательств), поэтому priors.json держит измеренные точки по тирам, между ними - линейная интерполяция.
function e3Cost(points, n) {
  const xs = Object.keys(points).map(Number).sort((a, b) => a - b);
  if (n <= xs[0]) return points[xs[0]];
  for (let i = 1; i < xs.length; i++) if (n <= xs[i]) return points[xs[i - 1]] + (points[xs[i]] - points[xs[i - 1]]) * (n - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return points[xs[xs.length - 1]];
}

function planOf(cells, tiers, reps) {
  const priors = JSON.parse(readFileSync(join(HERE, 'priors.json'), 'utf8'));
  let est = 0; const calls = cells.length * tiers.length * reps;
  for (const c of cells) {
    const tokens = ((c.prompt?.length ?? 0) + (c.append?.length ?? 0)) / 3;
    for (const t of tiers) {
      const n = c.exp === 'E3' && priors.e3CellUsdByN?.[t] ? Number(/^n(\d+)$/.exec(c.cond)?.[1]) : NaN;
      est += (Number.isFinite(n) ? e3Cost(priors.e3CellUsdByN[t], n) : priors.costPerCellUsd[c.kind][t] * (1 + tokens / priors.baselineInputTokens)) * reps;
    }
  }
  return { calls, est, high: est * priors.uncertainty };
}

function sandboxDir(out, c, tier, rep) { return join(out, 'w', `${c.exp}-${c.cond}-${c.case}-${tier}-${rep}`.replace(/[^\w.-]+/g, '_')); }

function setup(c, dir, commit) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (c.fixture === 'repo') {
    const r = spawnSync('sh', ['-c', 'git -C "$0" archive "$1" | tar -x -C "$2"', ROOT, commit, dir], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git archive: ${r.stderr}`);
    symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  } else if (c.fixture) cpSync(c.fixture, dir, { recursive: true });
  c.prepare?.(dir);
}

function runCell(c, tier, rep, o) {
  const dir = sandboxDir(o.out, c, tier, rep);
  setup(c, dir, o.commit);
  const before = snapshot(dir);
  const model = TIERS[tier];
  const args = ['-p', c.prompt, '--model', model, '--effort', o.effort, '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', String(o.cellCap), '--strict-mcp-config'];
  if (c.append) {
    const f = join(o.out, 'append', `${c.exp}-${c.cond}-${c.case}.md`.replace(/[^\w.-]+/g, '_'));
    mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, c.append);
    args.push('--append-system-prompt-file', f);
  }
  const mod = o.mods[c.exp];
  if (c.kind === 'text') args.push('--restricted');
  else args.push('--setting-sources', 'project', '--tools', (c.tools ?? mod.tools).join(','), '--permission-mode', 'acceptEdits', '--allowedTools', ...(c.allow ?? mod.allow), '--strict-mcp-config');
  const t0 = Date.now();
  const r = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', timeout: o.timeoutMs, maxBuffer: 1 << 26, env: { ...process.env, ...GIT_SANDBOX_ENV } });
  const row = { exp: c.exp, cond: c.cond, case: c.case, tier, rep, ts: new Date().toISOString(), wallMs: Date.now() - t0, srcChars: c.srcChars };
  let d = null;
  try { d = JSON.parse(r.stdout); } catch { row.error = `нет JSON (код ${r.status}): ${(r.stderr || r.stdout || '').slice(0, 300)}`; }
  if (d) {
    row.cost = d.total_cost_usd ?? 0; row.turns = d.num_turns; row.durationMs = d.duration_ms;
    row.usage = { in: d.usage?.input_tokens, out: d.usage?.output_tokens, cacheRead: d.usage?.cache_read_input_tokens, cacheCreate: d.usage?.cache_creation_input_tokens };
    row.models = Object.keys(d.modelUsage ?? {});
    if (d.is_error || d.subtype !== 'success') row.error = `${d.subtype}: ${String(d.result ?? '').slice(0, 200)}`;
    else if (row.models.length && !row.models.includes(model)) row.error = `модель не закреплена: ожидали ${model}, получили ${row.models.join(',')}`;
  }
  const output = String(d?.result ?? '');
  row.outChars = output.length; row.excerpt = output.slice(0, 400);
  const checks = row.error && !d ? [] : gradeAll(c.graders, { dir, before, output });
  Object.assign(row, { checks, ...cellScore(checks) });
  if (row.error) { row.score = 0; row.full = false; }
  if (!o.keep) rmSync(dir, { recursive: true, force: true });
  return row;
}

/** Хэш входов стенда (experiments/**, lib/**, priors.json): по нему видно, что между двумя сериями наборы и раннер не правились. */
function inputsHash() {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
  walk(join(HERE, 'experiments')); walk(join(HERE, 'lib'));
  files.push(join(HERE, 'priors.json'));
  const h = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
  const per = Object.fromEntries(files.map((f) => [relative(HERE, f), h(f)]));
  return { all: createHash('sha256').update(JSON.stringify(per)).digest('hex'), files: per };
}

/** Одна серия: ячейки эксперимента -> results.jsonl в --out. Возвращает {spent, stopped, errors, commit}; код выхода выставляет вызывающий. */
async function runSeries(id, opt) {
  if (!opt.out || !opt.budget) throw new Error('run требует --out <каталог> и --budget <USD>');
  const out = resolve(opt.out);
  if (out === ROOT || out.startsWith(ROOT + sep)) throw new Error('--out внутри репозитория');
  for (let d = out; d !== dirname(d); d = dirname(d)) for (const f of ['CLAUDE.md', 'AGENTS.md']) if (existsSync(join(d, f))) throw new Error(`${f} на пути песочницы: ${d}`);
  mkdirSync(out, { recursive: true });
  const tiers = (opt.tiers ?? 'haiku,sonnet,opus').split(',');
  const reps = Number(opt.reps ?? 3);
  const { mod, cells, commit } = await cellsOf(id, opt);
  const todo = [];
  for (const c of cells) for (const t of tiers) for (let r = 1; r <= reps; r++) todo.push([c, t, r]);
  const results = join(out, 'results.jsonl');
  const done = new Set(existsSync(results) ? readFileSync(results, 'utf8').split('\n').filter(Boolean).map((l) => { const x = JSON.parse(l); return `${x.exp}|${x.cond}|${x.case}|${x.tier}|${x.rep}`; }) : []);
  let spent = existsSync(results) ? readFileSync(results, 'utf8').split('\n').filter(Boolean).reduce((a, l) => a + (JSON.parse(l).cost ?? 0), 0) : 0;
  const queue = todo.filter(([c, t, r]) => !done.has(cellKey(c, t, r))).slice(0, opt.limit ? Number(opt.limit) : undefined);
  const claudeVersion = spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout?.trim();
  const metaFile = join(out, 'meta.json');
  const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : { baselines: {}, runs: [] };
  // Серия - один коммит и один набор: продолжение прерванной серии на другом коммите или после правки стенда отвергается.
  const hash = inputsHash().all;
  const prev = meta.runs.find((x) => x.exp === id);
  if (prev && (prev.repoCommit !== commit || prev.inputsHash !== hash)) throw new Error(`${out}: серия ${id} начата на коммите ${prev.repoCommit?.slice(0, 8)} / входах ${prev.inputsHash?.slice(0, 8)}, сейчас ${commit.slice(0, 8)} / ${hash.slice(0, 8)}`);
  meta.baselines[id] = mod.baseline;
  meta.runs.push({ ts: new Date().toISOString(), exp: id, tiers, reps, claudeVersion, repoCommit: commit, inputsHash: hash, args: opt });
  writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  const o = { out, effort: opt.effort ?? 'medium', cellCap: opt['cell-cap'] ?? 2, commit, keep: !!opt.keep, timeoutMs: 15 * 60 * 1000, mods: { [id]: mod } };
  const budget = Number(opt.budget);
  console.log(`${id}: ячеек в очереди ${queue.length} из ${todo.length}, потрачено ${spent.toFixed(2)} из ${budget} USD, коммит ${commit.slice(0, 8)}`);
  let stopped = false; let i = 0; let errors = 0;
  const worker = async () => {
    while (!stopped && i < queue.length) {
      if (spent >= budget) { stopped = true; break; }
      const [c, t, r] = queue[i++];
      let row;
      try { row = runCell(c, t, r, o); } catch (e) { row = { exp: c.exp, cond: c.cond, case: c.case, tier: t, rep: r, error: String(e.message).slice(0, 300), score: 0, full: false, cost: 0, checks: [] }; }
      appendFileSync(results, JSON.stringify(row) + '\n');
      spent += row.cost ?? 0; if (row.error) errors++;
      console.log(`${i}/${queue.length} ${c.cond}/${c.case} ${t}#${r} score=${row.score?.toFixed(2)} cost=${(row.cost ?? 0).toFixed(3)}${row.error ? ' ОШИБКА ' + row.error.slice(0, 80) : ''}`);
    }
  };
  await Promise.all(Array.from({ length: Number(opt.parallel ?? 2) }, worker));
  console.log(`итого потрачено ${spent.toFixed(2)} USD, ошибок ячеек ${errors}${stopped ? `; ОСТАНОВЛЕНО по бюджету ${budget}` : ''}`);
  return { spent, stopped, errors, commit, out };
}

async function cmdRun(id, opt) {
  const r = await runSeries(id, opt);
  process.exit(r.stopped ? 3 : r.errors ? 1 : 0);
}

/** Две независимые базовые серии на одном коммите: условие-база эксперимента (или --conditions) в <out>/A и <out>/B, подряд, без правок стенда между ними
 *  (хэш входов в meta.json обеих серий сверяется). --budget - общий на обе серии. Затем печатается полоса шума. */
async function cmdBaseline(id, opt) {
  if (!opt.out || !opt.budget) throw new Error('baseline требует --out <каталог> и --budget <USD> (общий на A и B)');
  const mod = await load(id);
  const o = { ...opt, conditions: opt.conditions ?? mod.baseline, commit: resolveCommit(opt.commit ?? 'HEAD') };
  const dirs = ['A', 'B'].map((x) => join(resolve(opt.out), x));
  const half = Number(opt.budget) / 2;
  let worst = 0;
  for (const d of dirs) {
    const r = await runSeries(id, { ...o, out: d, budget: String(half) });
    worst = Math.max(worst, r.stopped ? 3 : r.errors ? 1 : 0);
    if (r.stopped) break;
  }
  if (existsSync(join(dirs[1], 'results.jsonl'))) { console.log('\n' + cmdReport(dirs[0], dirs[1])); }
  process.exit(worst);
}

const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
function readRows(dir) { return readFileSync(join(resolve(dir), 'results.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); }

const readMeta = (dir) => JSON.parse(readFileSync(join(resolve(dir), 'meta.json'), 'utf8'));
const setOf = (meta, k) => [...new Set(meta.runs.map((r) => r[k]))];

/** Отчёт серии `dirA`. Полоса шума - из пары серий: `dirB` (вторая копия базы из dirA) либо `band` = [A, B] отдельных базовых серий (`baseline`). */
function cmdReport(dirA, dirB, band2) {
  const rows = readRows(dirA);
  const meta = readMeta(dirA);
  const pair = band2 ?? (dirB ? [dirA, dirB] : null);
  const o = [`# Отчёт eval55`, '', `Каталог: \`${dirA}\`. Ячеек: ${rows.length}, ошибок: ${rows.filter((r) => r.error).length}, потрачено: ${rows.reduce((a, r) => a + (r.cost ?? 0), 0).toFixed(2)} USD.`, ''];
  // Полоса имеет смысл только для серий одного коммита и одних входов стенда; расхождение - предупреждение в отчёте, а не молчание.
  if (pair) {
    const ms = [...pair, ...(band2 ? [dirA] : [])].map(readMeta);
    for (const k of ['repoCommit', 'inputsHash']) {
      const vals = new Set(ms.flatMap((m) => setOf(m, k)));
      if (vals.size > 1) o.push(`**ПРЕДУПРЕЖДЕНИЕ: серии различаются по \`${k}\` (${[...vals].map((v) => String(v).slice(0, 8)).join(', ')}): полоса шума не относится к сравнению.**`, '');
    }
  }
  const S = summarize(rows);
  o.push('| Эксперимент | Тир | Условие | n | Доля пройденных проверок | SE | Полное соблюдение | USD/ячейка | Ходов |', '|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const s of S) o.push(`| ${s.exp} | ${s.tier} | ${s.cond} | ${s.n} | ${f2(s.score)} | ${f2(s.scoreSe)} | ${f2(s.full)} | ${s.cost.toFixed(3)} | ${f2(s.turns)} |`);
  const band = pair ? noise(readRows(pair[0]), readRows(pair[1])) : [];
  o.push('', '## Разности условий от базы (парные, по case и rep)', '');
  o.push('| Эксперимент | Тир | Условие | База | Пар | Δ | SE | Порог (max полоса, 2 SE) | Вне порога |', '|---|---|---|---|---:|---:|---:|---:|---|');
  for (const exp of [...new Set(rows.map((r) => r.exp))]) {
    const base = meta.baselines[exp];
    if (!base) continue;
    for (const p of paired(rows.filter((r) => r.exp === exp), base)) {
      const b = band.find((x) => x.exp === exp && x.tier === p.tier && x.cond === base);
      const thr = Math.max(b?.band ?? 0, 2 * (p.se || 0));
      o.push(`| ${exp} | ${p.tier} | ${p.cond} | ${p.base} | ${p.pairs} | ${f2(p.delta)} | ${f2(p.se)} | ${f2(thr)}${b ? '' : ' (без полосы шума)'} | ${Math.abs(p.delta) > thr ? 'да' : 'нет'} |`);
    }
  }
  // Проверки, на которых условия расходятся внутри кейса: для E2 это нарушение правила (rule-held:*), для E10 - выход за границу.
  const diff = [];
  const grp = new Map();
  for (const r of rows) for (const c of r.checks ?? []) {
    const k = `${r.exp}|${r.tier}|${r.case}|${c.id}`;
    const g = grp.get(k) ?? grp.set(k, new Map()).get(k);
    const a = g.get(r.cond) ?? g.set(r.cond, []).get(r.cond); a.push(c.pass ? 1 : 0);
  }
  for (const [k, g] of grp) {
    const rates = [...g.entries()].map(([cond, xs]) => [cond, xs.reduce((a, b) => a + b, 0) / xs.length, xs.length]);
    if (new Set(rates.map((x) => x[1])).size > 1) diff.push(`| ${k.split('|').join(' | ')} | ${rates.map(([cond, v, n]) => `${cond} ${f2(v)} (n=${n})`).join('; ')} |`);
  }
  if (diff.length) o.push('', '## Проверки, на которых условия расходятся (по кейсу)', '', '| Эксперимент | Тир | Кейс | Проверка | Доля прохождения по условиям |', '|---|---|---|---|---|', ...diff);
  if (pair) {
    o.push('', '## Полоса шума (два независимых прогона базы): max(\\|A - B\\|, 2 SE разности средних)', '', '| Эксперимент | Тир | Условие | nA | nB | A | B | \\|A - B\\| | 2 SE | Полоса |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const b of band) o.push(`| ${b.exp} | ${b.tier} | ${b.cond} | ${b.nA} | ${b.nB} | ${f2(b.a)} | ${f2(b.b)} | ${f2(b.diff)} | ${f2(b.se2)} | ${f2(b.band)} |`);
  }
  return o.join('\n');
}

async function cmdSelftest(opt) {
  let bad = 0;
  const commit = resolveCommit(opt.commit ?? 'HEAD');
  for (const id of EXPERIMENTS) {
    const mod = await load(id);
    const cells = mod.build({ commit });
    const keys = new Set(); const problems = [];
    if (!cells.length) problems.push('нет ячеек');
    for (const c of cells) {
      const k = `${c.cond}|${c.case}`; if (keys.has(k)) problems.push(`дубль ${k}`); keys.add(k);
      if (!c.prompt) problems.push(`нет prompt ${k}`);
      for (const g of c.graders) {
        if (!GRADER_TYPES.includes(g.type)) problems.push(`грейдер ${g.type}`);
        if (g.regex) { try { new RegExp(g.regex, g.flags ?? 'u'); } catch (e) { problems.push(`регулярка ${k}/${g.id ?? g.type}: ${e.message}`); } }
      }
      if (c.fixture && c.fixture !== 'repo' && !existsSync(c.fixture)) problems.push(`нет фикстуры ${c.fixture}`);
    }
    if (mod.baseline && !cells.some((c) => c.cond === mod.baseline)) problems.push(`база ${mod.baseline} не среди условий`);
    problems.push(...(mod.selfcheck?.({ commit }) ?? []).map((x) => `ограничение не найдено в исходном тексте: ${x}`));
    problems.push(...(mod.audit?.({ commit }) ?? []));
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${id}: ячеек ${cells.length}, условий ${new Set(cells.map((c) => c.cond)).size}, кейсов ${new Set(cells.map((c) => c.case)).size}${problems.length ? ' - ' + problems.slice(0, 5).join('; ') : ''}`);
    if (problems.length) bad = 1;
  }
  process.exit(bad);
}

// Ступени из PREREG: размеры серий (--cases) задаёт ступень, если не передан явно. E3: seed на размер.
// Решение владельца: тиры Haiku и Sonnet (Opus не гоняется), E7 отложен до постановки с жёсткими соседями (#35) и в ступень 1 не входит. Для E7 `plan E7 --cases 40` работает по-прежнему.
const STAGES = { stage1: { E3: { cases: 10 }, E5: {}, E10: {} }, stage2: { E1: {}, E2: {} } };

/** Оценка по priors.json. Ступень печатается для Haiku+Sonnet (--tiers меняет), с калибровкой шума (вторая копия базового условия). */
async function cmdPlan(a, opt) {
  const stage = STAGES[a];
  const ids = stage ? Object.keys(stage) : a === 'all' ? EXPERIMENTS : [a];
  const reps = Number(opt.reps ?? 3);
  const tierSets = opt.tiers ? [opt.tiers.split(',')] : [['haiku', 'sonnet']];
  for (const tiers of tierSets) {
    let total = 0; let totalHigh = 0; let calTotal = 0;
    console.log(`\nТиры: ${tiers.join(', ')}; повторов ${reps}${stage ? `; ${a}` : ''}\n`);
    console.log('| Эксперимент | Ячеек | Условий | Кейсов | Вызовов | Оценка, USD | Калибровка шума, USD | Итого, USD | До, USD |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const id of ids) {
      const { mod, cells } = await cellsOf(id, { ...(stage?.[id] ?? {}), ...opt });
      const p = planOf(cells, tiers, reps);
      const cal = planOf(cells.filter((c) => c.cond === mod.baseline), tiers, reps);
      total += p.est; calTotal += cal.est; totalHigh += p.high + cal.high;
      console.log(`| ${id} | ${cells.length} | ${new Set(cells.map((c) => c.cond)).size} | ${new Set(cells.map((c) => c.case)).size} | ${p.calls} | ${p.est.toFixed(1)} | ${cal.est.toFixed(1)} | ${(p.est + cal.est).toFixed(1)} | ${(p.high + cal.high).toFixed(1)} |`);
    }
    console.log(`\nИтого: ${(total + calTotal).toFixed(1)} USD (серии ${total.toFixed(1)} + калибровка ${calTotal.toFixed(1)}), верхняя граница ${totalHigh.toFixed(1)} USD. Оценка грубая: priors.json (цены Opus и text Sonnet - см. поле extrapolated).`);
  }
}

async function main() {
  const { pos, opt } = parseArgs(process.argv.slice(2));
  const [cmd, a, b] = pos;
  if (cmd === 'list') {
    for (const id of EXPERIMENTS) { const m = await load(id); console.log(`${id}\t${m.kind}\t${m.title}\tбаза: ${m.baseline}`); }
  } else if (cmd === 'selftest') await cmdSelftest(opt);
  else if (cmd === 'plan') await cmdPlan(a, opt);
  else if (cmd === 'run') await cmdRun(a, opt);
  else if (cmd === 'report') console.log(cmdReport(a, b, opt.band ? opt.band.split(',') : null));
  else if (cmd === 'baseline') await cmdBaseline(a, opt);
  else if (cmd === 'hash') { const h = inputsHash(); console.log(JSON.stringify(h, null, 2)); }
  else { console.error('Usage: run.mjs list | selftest | hash | plan <E*|all|stage1|stage2> | run <E*> --out DIR --budget USD | baseline <E*> --out DIR --budget USD | report DIR [DIR2 | --band A,B]'); process.exit(2); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
