#!/usr/bin/env node
/**
 * Бюджет листинга и различимость `description`: skills, агенты, команды каталога.
 *
 * Это измерение, не валидатор: порогов "нарушено" и кодов возврата нет, правила в реестр валидаторов не заводятся.
 * Без внешних зависимостей, кроме gray-matter (как у measure-context.js).
 *
 * Режимы:
 *   node tools/description-listing.js                  # бюджет: суммы, максимум, распределение, длинные описания
 *   node tools/description-listing.js --pairs          # пары с близостью не ниже порога (по умолчанию 0.5)
 *   node tools/description-listing.js --pairs=0.6      # свой порог
 *   node tools/description-listing.js --bundles        # листинг при установке одного бандла (includes + dependencies)
 *   node tools/description-listing.js --json           # машинный вывод (бюджет, пары, бандлы)
 *
 * Близость - косинус TF-IDF по токенам описания. Токен: слово из букв и цифр, нижний регистр, длиной не менее 3
 * знаков, без служебных слов; русские слова усечены до 5 знаков (грубая основа, чтобы "ловушки" и "ловушек"
 * совпали). Корпус - все описания трёх видов сразу: общая лексика ("активируется", "триггеры") получает малый вес
 * сама. Метрика лексическая и пересечение смысла не доказывает: список пар - вход для ручной классификации,
 * не вердикт. Сравниваются только описания разных артефактов; пара "skill - его же команда" в список входит.
 */

import { readdirSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

const STOP = new Set(['при', 'для', 'как', 'что', 'или', 'без', 'над', 'под', 'это', 'все', 'его', 'она', 'они', 'так', 'вне', 'из', 'the', 'and', 'for', 'with', 'use', 'when', 'from', 'into', 'this', 'that', 'активируется', 'триггеры', 'trigger', 'triggers', 'используй', 'используйте', 'используется']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = lstatSync(full);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

const rel = (p) => relative(REPO_ROOT, p).split('\\').join('/');
const chars = (s) => Array.from(s).length;
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

function descriptionOf(path) {
  try {
    const d = matter(readFileSync(path, 'utf8'), {}).data || {};
    return typeof d.description === 'string' ? d.description.replace(/\s+/g, ' ').trim() : '';
  } catch {
    return '';
  }
}

function collect() {
  const files = walk(join(REPO_ROOT, 'plugins')).map((f) => f.split('\\').join('/'));
  const items = [];
  const pluginOf = (f) => (/\/plugins\/(?:[^/]+\/)*?(dex-[^/]+)\/(?:agents|commands|skills|\.claude-plugin)\//.exec(f) || [])[1] || '';
  for (const f of files) {
    let kind = null;
    let name = null;
    if (basename(f) === 'SKILL.md') { kind = 'skill'; name = basename(dirname(f)); }
    else if (/\/agents\/[^/]+\.md$/.test(f)) { kind = 'agent'; name = basename(f, '.md'); }
    else if (/\/commands\/[^/]+\.md$/.test(f)) { kind = 'command'; name = basename(f, '.md'); }
    if (!kind) continue;
    const description = descriptionOf(f);
    items.push({ kind, name, plugin: pluginOf(f), path: rel(f), description, chars: chars(description), bytes: bytes(description) });
  }
  return items;
}

function stat(items) {
  const xs = items.map((i) => i.chars).sort((a, b) => a - b);
  const q = (p) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(p * xs.length))] : 0);
  return {
    n: items.length,
    chars: sum(xs),
    bytes: sum(items.map((i) => i.bytes)),
    mean: xs.length ? Math.round(sum(xs) / xs.length) : 0,
    median: q(0.5),
    p90: q(0.9),
    max: xs.length ? xs[xs.length - 1] : 0,
    over400: xs.filter((x) => x > 400).length,
    over500: xs.filter((x) => x > 500).length,
    over750: xs.filter((x) => x > 750).length,
    over1536: xs.filter((x) => x > 1536).length,
    empty: xs.filter((x) => x === 0).length,
    buckets: [100, 200, 300, 400, 500, 750, 1536].map((hi, i, a) => ({ upTo: hi, n: xs.filter((x) => x > (a[i - 1] ?? 0) && x <= hi).length })).concat([{ upTo: null, n: xs.filter((x) => x > 1536).length }]),
  };
}

function budget(items) {
  const kinds = [['skill', 'skills'], ['agent', 'агенты'], ['command', 'команды']];
  const out = {};
  for (const [k] of kinds) out[k] = stat(items.filter((i) => i.kind === k));
  out.all = stat(items);
  return out;
}

// --- близость ---
function tokens(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || [];
  const out = [];
  for (const w of words) {
    if (Array.from(w).length < 3 || STOP.has(w)) continue;
    out.push(/[а-яё]/.test(w) && w.length > 5 ? w.slice(0, 5) : w);
  }
  return out;
}

function similarity(items) {
  const docs = items.map((i) => tokens(i.description));
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  const vecs = docs.map((d) => {
    const tf = new Map();
    for (const t of d) tf.set(t, (tf.get(t) || 0) + 1);
    const v = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(c)) * Math.log((N + 1) / (df.get(t) + 1) + 1);
      v.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  });
  const sets = docs.map((d) => new Set(d));
  const pairs = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let dot = 0;
      const [a, b] = vecs[i].size <= vecs[j].size ? [vecs[i], vecs[j]] : [vecs[j], vecs[i]];
      for (const [t, w] of a) { const o = b.get(t); if (o) dot += w * o; }
      let inter = 0;
      for (const t of sets[i]) if (sets[j].has(t)) inter++;
      const uni = sets[i].size + sets[j].size - inter;
      pairs.push({ i, j, cosine: Math.round(dot * 1000) / 1000, jaccard: uni ? Math.round((inter / uni) * 1000) / 1000 : 0 });
    }
  }
  return pairs.sort((x, y) => y.cosine - x.cosine);
}

const label = (it) => `${it.kind}:${it.plugin ? `${it.plugin}:` : ''}${it.name}`;

function pairList(items, threshold) {
  return similarity(items)
    .filter((p) => p.cosine >= threshold)
    .map((p) => ({ cosine: p.cosine, jaccard: p.jaccard, a: label(items[p.i]), b: label(items[p.j]), aChars: items[p.i].chars, bChars: items[p.j].chars }));
}

// Установка бандла = includes + dependencies (+ authorOnly): столько плагинов реально попадает в листинг пользователя.
function bundles(items) {
  const out = [];
  for (const f of walk(join(REPO_ROOT, 'plugins/bundles')).filter((p) => basename(p) === 'bundle.json')) {
    let b;
    try { b = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    const set = new Set([...(b.includes || []), ...(b.dependencies || []), ...(b.authorOnly || [])]);
    const mine = items.filter((i) => set.has(i.plugin));
    const row = { bundle: basename(dirname(f)), plugins: set.size };
    for (const k of ['skill', 'agent', 'command']) {
      const xs = mine.filter((i) => i.kind === k);
      row[k] = { n: xs.length, chars: sum(xs.map((i) => i.chars)) };
    }
    out.push(row);
  }
  return out.sort((a, b) => b.skill.chars + b.agent.chars + b.command.chars - (a.skill.chars + a.agent.chars + a.command.chars));
}

const arg = (name) => process.argv.slice(2).find((a) => a === name || a.startsWith(`${name}=`));
const items = collect();
const pairsArg = arg('--pairs');
const threshold = pairsArg && pairsArg.includes('=') ? Number(pairsArg.split('=')[1]) : 0.5;

if (arg('--json')) {
  const o = { commit: null, budget: budget(items) };
  if (pairsArg) o.pairs = pairList(items, threshold);
  if (arg('--bundles')) o.bundles = bundles(items);
  process.stdout.write(`${JSON.stringify(o, null, 2)}\n`);
} else if (arg('--bundles')) {
  console.log('# Листинг при установке одного бандла (знаков description)\n');
  console.log('| Бандл | Плагинов | Skills шт./знаков | Агентов шт./знаков | Команд шт./знаков | Всего знаков |\n|---|---:|---:|---:|---:|---:|');
  for (const r of bundles(items)) console.log(`| \`${r.bundle}\` | ${r.plugins} | ${r.skill.n}/${r.skill.chars} | ${r.agent.n}/${r.agent.chars} | ${r.command.n}/${r.command.chars} | ${r.skill.chars + r.agent.chars + r.command.chars} |`);
} else if (pairsArg) {
  const list = pairList(items, threshold);
  console.log(`# Пары описаний с близостью не ниже ${threshold} (${list.length} из ${(items.length * (items.length - 1)) / 2})\n`);
  console.log('| Косинус | Жаккар | A | B | Знаков A/B |\n|---:|---:|---|---|---:|');
  for (const p of list) console.log(`| ${String(p.cosine).replace('.', ',')} | ${String(p.jaccard).replace('.', ',')} | \`${p.a}\` | \`${p.b}\` | ${p.aChars}/${p.bChars} |`);
} else {
  const b = budget(items);
  console.log('# Бюджет листинга: description\n');
  console.log('| Вид | Шт. | Знаков | Байт | Среднее | Медиана | p90 | Макс. | >400 | >500 | >750 | >1536 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [k, title] of [['skill', 'skills'], ['agent', 'агенты'], ['command', 'команды'], ['all', 'всего']]) {
    const s = b[k];
    console.log(`| ${title} | ${s.n} | ${s.chars} | ${s.bytes} | ${s.mean} | ${s.median} | ${s.p90} | ${s.max} | ${s.over400} | ${s.over500} | ${s.over750} | ${s.over1536} |`);
  }
  console.log('\nРаспределение по длине (знаков):\n');
  console.log('| Вид | ' + b.all.buckets.map((x) => (x.upTo ? `до ${x.upTo}` : 'больше 1536')).join(' | ') + ' |');
  console.log('|---|' + b.all.buckets.map(() => '---:').join('|') + '|');
  for (const [k, title] of [['skill', 'skills'], ['agent', 'агенты'], ['command', 'команды']]) console.log(`| ${title} | ${b[k].buckets.map((x) => x.n).join(' | ')} |`);
}
