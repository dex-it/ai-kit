#!/usr/bin/env node
/**
 * Проверка дрейфа норм: устаревшие ссылки, числа и сроки сверки.
 *
 * Отдельная команда (`npm run check:drift`), в `validate` не входит: валидаторы судят структуру
 * артефакта, а здесь предмет - согласованность текстов между собой и с каталогом. Нулевой уровень
 * ложных срабатываний доказан на текущем дереве (список исключений - EXCLUDED_* ниже, у каждого
 * причина); до такого доказательства на другом дереве проверка остаётся сигналом.
 *
 * Категории:
 *   a - путь или идентификатор в code-span нормы не существует: путь от корня каталога, `npm run X`
 *       без скрипта X в package.json, адрес `{plugin}:{artifact}` без плагина или артефакта.
 *   b - раздел документа, названный в тексте, не существует: ссылка `файл#якорь`, «файл, раздел X»,
 *       «раздел X в файле», сообщение валидатора со ссылкой на раздел. Раздел - заголовок или
 *       жирный лейбл целевого файла. `CLAUDE.md` с директивой `@AGENTS.md` читается вместе с ней.
 *   c - число, которое должно совпадать с каталогом: версия каталога в README и других носителях,
 *       «N плагинов/skills/...» в живых текстах, перечень плагинов на диске против marketplace.json.
 *   d - утверждение «сверено ДД.ММ.ГГГГ» (и ссылка на документацию с датой) старше порога. Сигнал,
 *       не ошибка: код возврата меняет только с --strict.
 *
 * Код возврата: 1 при находках a-c; с --strict - и при находках d; иначе 0.
 *
 * Запуск: node tools/check-drift.js [--root <dir>] [--stale-days N] [--today YYYY-MM-DD]
 *                                    [--only a,b,c,d] [--strict] [--json]
 * --json печатает машинный вывод с числом проверенных ссылок (вход для E15, доля устаревших).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Корни, где ссылки не судятся, и причина. Список закрытый: расширять только с причиной. */
export const EXCLUDED_PREFIXES = [
  ['node_modules/', 'зависимости'],
  ['.git/', 'служебный каталог'],
  ['docs/research/', 'архив прогонов: тексты фиксируют состояние на дату, ссылки исторические'],
  ['docs/migration/', 'журнал миграции: записи на дату, старые имена разделов в них - предмет записи'],
  ['plugins/auto/docs/notes/', 'журнал проб движка: записи на дату'],
  ['plugins/auto/docs/ledger.md', 'рабочая записка проектирования на 06-07.09.2026 («движка ещё нет»): снятый движок назван действующим по состоянию на дату'],
  ['plugins/auto/docs/adr/', 'ADR фиксирует решение и его контекст на дату принятия'],
  ['site/', 'витрина-сайт собирается из docs/, свои тексты не несёт'],
  ['tools/__fixtures__/', 'фикстуры валидаторов: дефект в них заложен намеренно'],
  ['tests/', 'фикстуры и кейсы: чужие проекты со своими CLAUDE.md (кроме tests/README.md)'],
];
const INCLUDED_UNDER_EXCLUDED = new Set(['tests/README.md']);

/** Корневые каталоги и файлы, с которых путь в code-span считается путём этого репозитория. */
const REPO_ROOT_DIRS = ['plugins', 'docs', 'tools', 'tests', 'mods', 'install-bundle', 'mcp', 'setup', 'adoption', '.claude', '.claude-plugin', '.github', '.memory-bank'];

/** Первые сегменты, которые в тексте плагина относительны каталогу артефакта, а не корню репозитория. */
const ARTIFACT_RELATIVE_DIRS = ['references', 'scripts', 'templates', 'assets'];

/**
 * Пути, которые норма называет, хотя их нет в дереве: пример формы, ещё не созданный носитель,
 * артефакт чужой среды. Ключ - путь в code-span, значение - причина.
 */
const USER_PROJECT = 'путь в проекте пользователя (вход или выход артефакта, пример формы): в каталоге его нет по построению';
export const EXCLUDED_PATHS = new Map([
  ['.claude/settings.json', USER_PROJECT],
  ['.claude/settings.local.json', USER_PROJECT],
  ['.claude/agents', USER_PROJECT],
  ['.claude/commands', USER_PROJECT],
  ['.claude/commands/deploy.md', USER_PROJECT],
  ['.claude/skills', USER_PROJECT],
  ['.claude/skills/deploy/SKILL.md', USER_PROJECT],
  ['.claude/CLAUDE.md', USER_PROJECT],
  ['.claude/worktrees', 'создаётся Claude Code при --worktree, в дереве его нет'],
  ['.claude-plugin/types', 'выход движка в папке мода (в .gitignore), исходника нет'],
  ['.github/workflows/ci.yml', USER_PROJECT],
  ['docs/discover', USER_PROJECT],
  ['docs/discover/README.md', USER_PROJECT],
  ['docs/brd/payments.md', USER_PROJECT],
  ['docs/requirements', USER_PROJECT],
  ['docs/adr', USER_PROJECT],
  ['docs/decisions', USER_PROJECT],
  ['docs/sample', USER_PROJECT],
  ['docs/X.md', USER_PROJECT],
  ['docs/guides/api-lists.md', USER_PROJECT],
  ['docs/notes/invoice-lists.md', USER_PROJECT],
  ['docs/sdlc-engine-tracks', 'имя ветки в таблице замера, не путь'],
  ['references/zone-registry.md', 'пример формы в «Плохо/Правильно» нормы реза пересказа'],
]);

/** Ссылка в конкретном файле, названная намеренно: ключ `файл|ссылка`. */
export const EXCLUDED_REFS = new Map([
  ['install-bundle/README.md|dex-sdlc:engine', 'снятый движок SDLC назван как причина ручного снятия старых плагинов (каталог 6.0.0)'],
]);

/** Имена плагинов, которые текст называет примером опечатки или несуществующего плагина, и причина. */
export const EXCLUDED_NAMES = new Map([
  ['dex-skill-nodecontract', 'пример опечатки в описании правила валидатора'],
  ['dex-skill-nowhere', 'пример несуществующего плагина в описании правила валидатора'],
]);

/** Строка в прошедшем времени или на дату - запись истории: имя и путь в ней названы как снятые. */
const HISTORY_LINE_RE = /(?<!\p{L})снят(?:ый|ом|ого|ая|ое|о|ы)?(?!\p{L})|удаляетс|в истории до|\b20\d{2}-\d{2}-\d{2}\b|переименован|\bwere written\b|\bwith both removed\b/iu;

const PLACEHOLDER_RE = /[<>{}*$|?[\]()~]|(?:^|[-/])X(?:[-/.]|$)|\.\.\.|…|\bNNN\b|\bXXX?\b|\bYYYY\b|\\/;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ---------- аргументы ----------

function parseArgs(argv) {
  const opts = { root: resolve(HERE, '..'), staleDays: 180, today: null, only: ['a', 'b', 'c', 'd'], strict: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') opts.root = resolve(argv[++i]);
    else if (a === '--stale-days') opts.staleDays = Number(argv[++i]);
    else if (a === '--today') opts.today = argv[++i];
    else if (a === '--only') opts.only = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--strict') opts.strict = true;
    else if (a === '--json') opts.json = true;
    else throw new Error(`неизвестный аргумент: ${a}`);
  }
  if (!Number.isFinite(opts.staleDays) || opts.staleDays < 0) throw new Error('--stale-days: нужно неотрицательное число');
  if (opts.today !== null && !ISO.test(opts.today)) throw new Error('--today: формат YYYY-MM-DD');
  return opts;
}

// ---------- дерево ----------

function walk(root) {
  const files = [];
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    for (const name of readdirSync(join(root, rel))) {
      if (name === '.git' || name === 'node_modules') continue;
      const relPath = rel ? `${rel}/${name}` : name;
      const st = statSync(join(root, relPath), { throwIfNoEntry: false });
      if (!st) continue;
      if (st.isDirectory()) stack.push(relPath);
      else files.push(relPath);
    }
  }
  return files.sort();
}

function isExcluded(rel) {
  if (INCLUDED_UNDER_EXCLUDED.has(rel)) return false;
  return EXCLUDED_PREFIXES.some(([prefix]) => rel.startsWith(prefix));
}

/** norms - корневые документы и docs/; skills - тела skills; artifacts - агенты, команды, README плагинов; tools - сообщения валидаторов. */
function groupOf(rel) {
  if (rel.startsWith('tools/') && rel.endsWith('.js')) return 'tools';
  if (!rel.endsWith('.md')) return null;
  if (rel.startsWith('plugins/')) return /\/skills\/.+\.md$/.test(rel) ? 'skills' : 'artifacts';
  if (rel.startsWith('mods/')) return 'artifacts';
  return 'norms';
}

// ---------- разбор markdown ----------

/** Тело без fenced-блоков: длина и переводы строк сохранены, номера строк не плывут. */
export function stripFences(text) {
  const out = [];
  let fence = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
      out.push('');
    } else if (m) {
      fence = m[1];
      out.push('');
    } else out.push(line);
  }
  return out.join('\n');
}

function normText(s) {
  return s
    .replace(/[`*_]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/[.:;,\s]+$/g, '')
    .trim()
    .toLowerCase();
}

/** Якорь заголовка по правилу GitHub: строчные, без пунктуации, пробел -> дефис, повтор получает -N. */
export function slugify(heading, seen) {
  let slug = normText(heading)
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
  const n = seen.get(slug) ?? 0;
  seen.set(slug, n + 1);
  if (n > 0) slug = `${slug}-${n}`;
  return slug;
}

/** Разделы документа: заголовки, жирные лейблы и якоря заголовков. */
export function sectionIndex(text) {
  const body = stripFences(text);
  const headings = [];
  const bolds = [];
  const anchors = new Set();
  const seen = new Map();
  for (const line of body.split('\n')) {
    const h = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (h) {
      headings.push(normText(h[1]));
      anchors.add(slugify(h[1], seen));
    }
    for (const b of line.matchAll(/\*\*([^*]+)\*\*/g)) bolds.push(normText(b[1]));
  }
  return { headings, bolds, anchors, labels: [...headings, ...bolds] };
}

function quoteMatches(index, quote) {
  const q = normText(quote.split(/\.\.\.|…/)[0]);
  if (q.length < 3) return true;
  return index.labels.some((l) => l.includes(q));
}

// ---------- ссылки на разделы (b) ----------

const FILE_ALT = String.raw`(?:\[[^\]\n]*\]\((?<link>[^)\s]+?\.md)(?<lanchor>#[^)\s]*)?\)|` +
  '`(?<tick>[^`\\s]+?\\.md)(?<tanchor>#[^`\\s]*)?`|' +
  String.raw`(?<![\w./-])(?<bare>(?:[\w.-]+/)*[A-Z][A-Z0-9_]*\.md)(?![\w/]))`;
const QUOTE_ALT = String.raw`(?:«(?<q1>[^»\n]{3,120})»|"(?<q2>[^"\n]{3,120})")`;
// файл, затем (раздел) «X»
const AFTER_RE = new RegExp(`${FILE_ALT}(?<sep>[\\s,(\\u2013-]{0,6})(?:раздел\\p{L}*\\s+|section\\s+|секци\\p{L}*\\s+)?${QUOTE_ALT}`, 'gu');
// «X» в файле
const BEFORE_RE = new RegExp(`${QUOTE_ALT}(?<sep>[ \\t,(]{0,3})(?<!\\p{L})(?:в|из|of|in)\\s+${FILE_ALT.replace(/\?<(\w+)>/g, '?<$1b>')}`, 'gu');

function lineOf(text, offset) {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

const BLOB_RE = /^https:\/\/github\.com\/dex-it\/ai-kit\/blob\/(?:main|develop)\//;

/**
 * Кандидаты целевого файла ссылки. Точный путь (от корня или от файла-источника) побеждает; иначе
 * имя без пути и пути на `references/`, `commands/`, `agents/`, `skills/` ищутся по хвосту среди
 * файлов каталога: агент называет `references/x.md` загружаемого skill, а не соседа по каталогу.
 * Имя без пути из плагина или кейса - файл чужого проекта (`CLAUDE.md` пользователя), не судится.
 */
function resolveDocTarget(ctx, from, raw, kind) {
  let clean = raw.replace(/^\.\//, '');
  if (BLOB_RE.test(clean)) {
    clean = clean.replace(BLOB_RE, '');
    kind = 'root';
  }
  const hasDir0 = clean.includes('/');
  // имя без пути из плагина или кейса - файл чужого проекта (`CLAUDE.md` пользователя), не судится
  if (!hasDir0 && kind !== 'link' && (from.startsWith('plugins/') || from.startsWith('mods/') || from.startsWith('tests/'))) return { skip: true };
  const exact = [];
  if (kind === 'link') exact.push(posix.normalize(posix.join(posix.dirname(from), clean)));
  else {
    exact.push(posix.normalize(clean));
    if (clean.includes('/')) exact.push(posix.normalize(posix.join(posix.dirname(from), clean)));
  }
  for (const c of exact) if (ctx.fileSet.has(c)) return { rels: [c] };
  const hasDir = clean.includes('/');
  const suffixOk = !hasDir || /^(?:references|commands|agents|skills)\//.test(clean);
  if (suffixOk && !clean.startsWith('..')) {
    const tail = `/${clean}`;
    const found = ctx.files.filter((f) => !isExcluded(f) && f.endsWith(tail));
    if (found.length) return { rels: found };
  }
  return { rels: [exact[0]], missing: true };
}

/** Индекс разделов целевого файла; CLAUDE.md с `@AGENTS.md` читает и подключённый файл. */
function indexOfDoc(ctx, rel) {
  if (ctx.indexCache.has(rel)) return ctx.indexCache.get(rel);
  let text = readFileSync(join(ctx.root, rel), 'utf8');
  const imports = [...text.matchAll(/^@(\S+\.md)\s*$/gm)].map((m) => posix.normalize(posix.join(posix.dirname(rel), m[1])));
  for (const imp of imports) if (ctx.fileSet.has(imp)) text += `\n${readFileSync(join(ctx.root, imp), 'utf8')}`;
  const index = sectionIndex(text);
  ctx.indexCache.set(rel, index);
  return index;
}

function checkSectionRefs(ctx, rel, text, findings) {
  const body = rel.endsWith('.md') ? stripFences(text) : text;
  const seen = new Set();
  const handle = (offset, kind, raw, anchor, quote) => {
    const line = lineOf(body, offset);
    const key = anchor ? `${line}|${raw}|${anchor}` : `${line}|${raw}|q|${quote}`;
    if (seen.has(key)) return;
    seen.add(key);
    const target = resolveDocTarget(ctx, rel, raw, kind);
    if (target.skip) return;
    ctx.stats.b.checked++;
    if (target.missing) {
      findings.push({ category: 'b', file: rel, line, ref: raw, message: `файл ${raw} не существует` });
      ctx.stats.b.broken++;
      return;
    }
    const indexes = target.rels.map((r) => indexOfDoc(ctx, r));
    const shown = target.rels[0];
    if (anchor) {
      const a = decodeURIComponent(anchor.slice(1));
      if (!indexes.some((ix) => ix.anchors.has(a))) {
        findings.push({ category: 'b', file: rel, line, ref: `${raw}${anchor}`, message: `в ${shown} нет заголовка с якорем #${a}` });
        ctx.stats.b.broken++;
      }
    } else if (quote && !quote.includes('${') && !indexes.some((ix) => quoteMatches(ix, quote))) {
      findings.push({ category: 'b', file: rel, line, ref: `${raw} «${quote}»`, message: `в ${shown} нет раздела «${quote}» (ни заголовка, ни лейбла)` });
      ctx.stats.b.broken++;
    }
  };
  const kindOf = (g) => (g.link ? 'link' : 'path');
  for (const m of body.matchAll(AFTER_RE)) {
    const g = m.groups;
    if (/\n\s*\n/.test(g.sep)) continue;
    handle(m.index, kindOf(g), g.link ?? g.tick ?? g.bare, g.lanchor ?? g.tanchor, g.q1 ?? g.q2);
  }
  for (const m of body.matchAll(BEFORE_RE)) {
    const g = m.groups;
    if (/\n\s*\n/.test(g.sep)) continue;
    const raw = g.linkb ?? g.tickb ?? g.bareb;
    handle(m.index, g.linkb ? 'link' : 'path', raw, g.lanchorb ?? g.tanchorb, g.q1 ?? g.q2);
  }
  // ссылки на якорь без раздела в тексте: [..](файл#якорь) и [..](#якорь)
  if (rel.endsWith('.md')) {
    for (const m of body.matchAll(/\]\((?<raw>[^)\s#]*)(?<anchor>#[^)\s]+)\)/g)) {
      const { raw, anchor } = m.groups;
      if (/^[a-z]+:/i.test(raw)) continue;
      if (raw && !raw.endsWith('.md')) continue;
      // пара «файл + якорь» могла быть разобрана выше вместе с названием раздела
      const key = `${lineOf(body, m.index)}|${raw}|${anchor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const targetRel = raw ? posix.normalize(posix.join(posix.dirname(rel), raw)) : rel;
      ctx.stats.b.checked++;
      if (!ctx.fileSet.has(targetRel)) {
        findings.push({ category: 'b', file: rel, line: lineOf(body, m.index), ref: `${raw}${anchor}`, message: `файл ${raw} не существует` });
        ctx.stats.b.broken++;
        continue;
      }
      const a = decodeURIComponent(anchor.slice(1));
      if (!indexOfDoc(ctx, targetRel).anchors.has(a)) {
        findings.push({ category: 'b', file: rel, line: lineOf(body, m.index), ref: `${raw}${anchor}`, message: `в ${targetRel} нет заголовка с якорем #${a}` });
        ctx.stats.b.broken++;
      }
    }
  }
}

// ---------- пути и идентификаторы в code-span (a) ----------

function pluginRootOf(rel) {
  const parts = rel.split('/');
  const i = parts.findIndex((p, k) => k > 0 && (p === 'skills' || p === 'agents' || p === 'commands' || p === 'references'));
  return i > 0 ? parts.slice(0, i).join('/') : posix.dirname(rel);
}

function skillDirOf(ctx, rel) {
  let dir = posix.dirname(rel);
  while (dir && dir !== '.' && dir !== 'plugins') {
    if (ctx.fileSet.has(`${dir}/SKILL.md`)) return dir;
    dir = posix.dirname(dir);
  }
  return null;
}

function checkPathRef(ctx, rel, token, line, findings) {
  const m = token.match(/^([A-Za-z0-9_.@/-]+?)(?::\d+(?:-\d+)?)?(#[\w-]*)?$/);
  if (!m) return;
  let path = m[1].replace(/\/$/, '');
  if (!path || path.startsWith('/') || path.startsWith('..') || path === '.' || path.includes('//')) return;
  if (PLACEHOLDER_RE.test(path)) return;
  const first = path.split('/')[0];
  const underPlugins = rel.startsWith('plugins/') || rel.startsWith('mods/');
  let candidates = null;
  if (EXCLUDED_PATHS.has(path)) return;
  if (first === '.claude-plugin' && path.includes('/')) {
    // манифест плагина: лежит в каждом плагине, в корне только marketplace.json
    ctx.stats.a.checked++;
    if (!ctx.fileSet.has(path) && !ctx.dirSet.has(path) && !ctx.files.some((f) => f.endsWith(`/${path}`) || f.includes(`/${path}/`))) {
      findings.push({ category: 'a', file: rel, line, ref: token, message: `путь ${path} не существует ни в корне, ни в одном плагине` });
      ctx.stats.a.broken++;
    }
    return;
  }
  if (path.includes('/') && ARTIFACT_RELATIVE_DIRS.includes(first) && underPlugins) {
    const base = skillDirOf(ctx, rel);
    if (!base) {
      // агент и команда называют `references/x.md` загружаемого skill: файл ищется среди references/ каталога
      ctx.stats.a.checked++;
      if (!ctx.files.some((f) => f.startsWith('plugins/') && f.endsWith(`/${path}`))) {
        findings.push({ category: 'a', file: rel, line, ref: token, message: `файла ${path} нет ни в одном плагине` });
        ctx.stats.a.broken++;
      }
      return;
    }
    candidates = [posix.join(base, path)];
    // skill называет `references/x.md` загружаемого соседа: файл ищется среди references/ каталога
    candidates.push(...ctx.files.filter((f) => f.startsWith('plugins/') && f.endsWith(`/${path}`)));
    if (first === 'assets' || first === 'scripts') candidates.push(posix.join(pluginRootOf(rel), path));
  } else if (underPlugins && first === '.github') {
    return;
  } else if (REPO_ROOT_DIRS.includes(first) && path.includes('/')) {
    // в плагине путь вида docs/... - текст о каталоге или о проекте пользователя, судится ссылка, а не span
    if (underPlugins && (first === 'docs' || first === 'tests' || first === 'tools' || first === 'plugins' || first === 'mods' || first === '.claude')) {
      if (!(first === 'plugins' || first === 'mods')) return;
    }
    candidates = [path];
  } else return;
  if (EXCLUDED_PATHS.has(path)) return;
  ctx.stats.a.checked++;
  const ok = candidates.some((c) => ctx.fileSet.has(c) || ctx.dirSet.has(c));
  if (!ok) {
    findings.push({ category: 'a', file: rel, line, ref: token, message: `путь ${path} не существует` });
    ctx.stats.a.broken++;
  }
}

function checkIdentifiers(ctx, rel, line, span, findings) {
  if (EXCLUDED_REFS.has(`${rel}|${span}`)) return;
  const npm = span.match(/^npm run ([a-z][\w:-]*)/);
  if (npm) {
    ctx.stats.a.checked++;
    if (!ctx.npmScripts.has(npm[1])) {
      findings.push({ category: 'a', file: rel, line, ref: span, message: `в package.json нет скрипта ${npm[1]}` });
      ctx.stats.a.broken++;
    }
    return;
  }
  const full = span.match(/^(dex-[a-z0-9-]+):([a-z][a-z0-9-]*)$/);
  if (full) {
    ctx.stats.a.checked++;
    const [, plugin, name] = full;
    if (EXCLUDED_NAMES.has(plugin) || ctx.removedNames.has(plugin)) return;
    if (!ctx.catalogNames.has(plugin)) {
      findings.push({ category: 'a', file: rel, line, ref: span, message: `плагина ${plugin} нет в marketplace.json` });
      ctx.stats.a.broken++;
    } else if (ctx.artifactMap.has(plugin) && !ctx.artifactMap.get(plugin).has(name)) {
      findings.push({ category: 'a', file: rel, line, ref: span, message: `у плагина ${plugin} нет skill, агента, команды или трека ${name}` });
      ctx.stats.a.broken++;
    }
    return;
  }
  const bare = span.match(/^dex-(?:skill|bundle)-[a-z0-9-]+$/) ?? span.match(/^dex-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  if (bare && ctx.checkBareNames) {
    ctx.stats.a.checked++;
    if (!ctx.catalogNames.has(span) && !ctx.removedNames.has(span)) {
      findings.push({ category: 'a', file: rel, line, ref: span, message: `плагина ${span} нет в marketplace.json и в таблице снятых` });
      ctx.stats.a.broken++;
    }
  }
}

function checkCodeSpans(ctx, rel, text, findings) {
  const body = stripFences(text);
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (HISTORY_LINE_RE.test(lines[i]) || (i > 0 && lines[i - 1].trim() && HISTORY_LINE_RE.test(lines[i - 1]))) continue;
    for (const m of lines[i].matchAll(/`([^`\n]+)`/g)) {
      const span = m[1].trim();
      checkIdentifiers(ctx, rel, i + 1, span, findings);
      if (!/\s/.test(span)) checkPathRef(ctx, rel, span, i + 1, findings);
      else {
        // `node tools/x.js`, `bash tests/...`: путь - второе слово
        const cmd = span.match(/^(?:node|bash|sh|python3?|cat|npx)\s+(?:--[\w-]+\s+)*([A-Za-z0-9_.@/-]+)(?:\s|$)/);
        if (cmd && cmd[1].includes('/')) checkPathRef(ctx, rel, cmd[1], i + 1, findings);
      }
    }
  }
}

// ---------- числа (c) ----------

const COUNT_WORDS = [
  [/^плагин/i, () => true, 'плагинов'],
  [/^skills?$|^скилл/i, (p) => p.category === 'skill', 'skills'],
  [/^специалист|^агент/i, (p) => p.category === 'specialist', 'специалистов'],
  [/^бандл|^bundles?$/i, (p) => p.category === 'bundle', 'бандлов'],
  [/^утилит/i, (p) => p.category === 'utility', 'утилит'],
  [/^мод(?:ов|а|ы)?$|^mods?$/i, (p) => p.category === 'mod', 'модов'],
];
const COUNT_RE = /(?<![\w./-])(\d{1,3})\s+(плагин\p{L}*|skills?|скилл\p{L}*|специалист\p{L}*|агент\p{L}*|бандл\p{L}*|bundles?|утилит\p{L}*|мод(?:ов|а|ы)?|mods?)(?![\p{L}\w])/giu;
const DATE_RE = /\b\d{2}\.\d{2}\.\d{4}\b/;
const VERSION_CARRIERS = [
  { file: 'README.md', re: /\*\*DEX Team\*\*[^\n]*?Version\s+(\d+\.\d+\.\d+)/ },
];
const LIVE_COUNT_FILES = (rel) => (rel === 'README.md' || rel === 'AGENTS.md' || rel.startsWith('docs/guide/') || rel.startsWith('docs/product/') || rel.startsWith('install-bundle/') || rel === 'adoption/README.md');

function categoryCounts(plugins) {
  const counts = {};
  for (const p of plugins) counts[p.category] = (counts[p.category] ?? 0) + 1;
  return counts;
}

function checkNumbers(ctx, findings) {
  const { catalog, plugins } = ctx;
  if (!catalog) {
    findings.push({ category: 'c', file: '.claude-plugin/marketplace.json', line: 1, ref: '', message: 'marketplace.json не читается: сверка чисел невозможна' });
    ctx.stats.c.broken++;
    return;
  }
  for (const carrier of VERSION_CARRIERS) {
    const abs = join(ctx.root, carrier.file);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    const m = text.match(carrier.re);
    ctx.stats.c.checked++;
    if (!m) {
      findings.push({ category: 'c', file: carrier.file, line: 1, ref: '', message: `носитель версии каталога не найден (ожидается ${catalog.version})` });
      ctx.stats.c.broken++;
    } else if (m[1] !== catalog.version) {
      findings.push({ category: 'c', file: carrier.file, line: lineOf(text, m.index), ref: m[1], message: `версия каталога ${m[1]} против ${catalog.version} в marketplace.json` });
      ctx.stats.c.broken++;
    }
  }
  // «версия каталога X.Y.Z» в живых текстах (строка со стрелкой - пример бампа)
  for (const rel of ctx.files) {
    if (!rel.endsWith('.md') || isExcluded(rel) || !LIVE_COUNT_FILES(rel)) continue;
    const text = readFileSync(join(ctx.root, rel), 'utf8');
    const lines = stripFences(text).split('\n');
    lines.forEach((ln, i) => {
      for (const m of ln.matchAll(/верси[яию]\s+каталога[^0-9\n]{0,30}(\d+\.\d+\.\d+)/giu)) {
        if (/->|→/.test(ln)) continue;
        ctx.stats.c.checked++;
        if (m[1] !== catalog.version) {
          findings.push({ category: 'c', file: rel, line: i + 1, ref: m[1], message: `версия каталога ${m[1]} против ${catalog.version} в marketplace.json` });
          ctx.stats.c.broken++;
        }
      }
      // «N плагинов» без пометки замера: живое утверждение о составе
      if (DATE_RE.test(ln) || /замер|на момент|было|стало|до правки/i.test(ln)) return;
      for (const m of ln.matchAll(COUNT_RE)) {
        const word = m[2];
        const rule = COUNT_WORDS.find(([re]) => re.test(word));
        if (!rule) continue;
        const want = plugins.filter(rule[1]).length;
        ctx.stats.c.checked++;
        if (Number(m[1]) !== want) {
          findings.push({ category: 'c', file: rel, line: i + 1, ref: m[0], message: `«${m[0]}» против ${want} ${rule[2]} в marketplace.json` });
          ctx.stats.c.broken++;
        }
      }
    });
  }
  // перечень плагинов на диске против marketplace.json
  const onDisk = new Map();
  for (const rel of ctx.files) {
    const m = rel.match(/^((?:plugins|mods)\/.+)\/\.claude-plugin\/plugin\.json$/);
    if (m) onDisk.set(m[1], rel);
  }
  const inCatalog = new Map(plugins.map((p) => [String(p.source).replace(/^\.\//, '').replace(/\/$/, ''), p]));
  for (const dir of onDisk.keys()) {
    ctx.stats.c.checked++;
    if (!inCatalog.has(dir)) {
      findings.push({ category: 'c', file: onDisk.get(dir), line: 1, ref: dir, message: `плагин ${dir} лежит на диске, а в marketplace.json его нет` });
      ctx.stats.c.broken++;
    }
  }
  for (const [src, p] of inCatalog) {
    ctx.stats.c.checked++;
    if (!onDisk.has(src)) {
      findings.push({ category: 'c', file: '.claude-plugin/marketplace.json', line: 1, ref: src, message: `запись ${p.name} ведёт на ${src}, где плагина нет` });
      ctx.stats.c.broken++;
    }
  }
  const cc = categoryCounts(plugins);
  ctx.catalogCounts = cc;
}

// ---------- сроки сверки (d) ----------

function parseRuDate(s) {
  const [d, m, y] = s.includes('-') ? s.split('-').map(Number).reverse() : s.split('.').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

const CLAIM_RES = [
  // «сверено 30.07.2026», «сверка по документации 30.07.2026», «проверено 27.10.2026»
  /(?:сверен\p{L}*|сверк\p{L}*|проверен\p{L}*)[^\n.]{0,80}?(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/giu,
  // [текст](https://code.claude.com/docs/...), 27.10.2026
  /\]\(https?:\/\/(?:code\.claude\.com|platform\.claude\.com|docs\.anthropic\.com)\/[^)\s]*\)[^\n)]{0,12}?(\d{2}\.\d{2}\.\d{4})/giu,
];

function checkFreshness(ctx, findings) {
  const today = ctx.todayMs;
  for (const rel of ctx.files) {
    if (!rel.endsWith('.md') || isExcluded(rel)) continue;
    const text = readFileSync(join(ctx.root, rel), 'utf8');
    const seen = new Set();
    for (const re of CLAIM_RES) {
      for (const m of text.matchAll(re)) {
        const offset = m.index + m[0].lastIndexOf(m[1]);
        if (seen.has(offset)) continue;
        seen.add(offset);
        const t = parseRuDate(m[1]);
        if (t === null) continue;
        ctx.stats.d.checked++;
        const age = Math.floor((today - t) / 86400000);
        if (age > ctx.staleDays) {
          findings.push({ category: 'd', file: rel, line: lineOf(text, offset), ref: m[1], message: `сверка ${m[1]} старше ${ctx.staleDays} дн. (${age} дн.)`, ageDays: age });
          ctx.stats.d.broken++;
        }
      }
    }
  }
}

// ---------- основной ход ----------

function loadCatalog(root) {
  try {
    const raw = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
    return { version: String(raw.version), plugins: Array.isArray(raw.plugins) ? raw.plugins : [] };
  } catch {
    return null;
  }
}

/** Имена из первой колонки таблицы «Renamed and removed plugins»: снятый плагин в тексте - история, не дрейф. */
function removedNames(root) {
  const names = new Set();
  const p = join(root, 'install-bundle', 'README.md');
  if (!existsSync(p)) return names;
  const text = readFileSync(p, 'utf8');
  const sec = text.split(/^## Renamed and removed plugins\s*$/m)[1];
  if (!sec) return names;
  for (const line of sec.split(/^## /m)[0].split('\n')) {
    const cell = line.match(/^\|\s*`?([a-z0-9-]+)`?\s*\|/);
    if (cell) names.add(cell[1]);
  }
  return names;
}

function buildArtifactMap(ctx) {
  // перечень артефактов плагина: skills/<name>/SKILL.md, agents/<name>.md, commands/<name>.md, треки по meta.name
  const map = new Map();
  for (const rel of ctx.files) {
    const pj = rel.match(/^((?:plugins|mods)\/.+)\/\.claude-plugin\/plugin\.json$/);
    if (!pj) continue;
    try {
      const name = JSON.parse(readFileSync(join(ctx.root, rel), 'utf8')).name;
      if (name) map.set(name, { dir: pj[1], names: new Set() });
    } catch {
      // нечитаемый манифест судит validate
    }
  }
  const byDir = new Map([...map].map(([n, v]) => [v.dir, n]));
  for (const rel of ctx.files) {
    let m = rel.match(/^(.+?)\/skills\/([^/]+)\/SKILL\.md$/);
    if (m && byDir.has(m[1])) {
      const fm = readFileSync(join(ctx.root, rel), 'utf8').match(/^---\n[\s\S]*?^name:\s*["']?([^\s"'\n]+)/m);
      map.get(byDir.get(m[1])).names.add(fm ? fm[1] : m[2]);
      continue;
    }
    m = rel.match(/^(.+?)\/(?:agents|commands)\/([^/]+)\.md$/);
    if (m && byDir.has(m[1])) map.get(byDir.get(m[1])).names.add(m[2]);
    m = rel.match(/^(.+?)\/(?:workflows|tracks)\/([^/]+)\.js$/);
    if (m && byDir.has(m[1])) {
      const meta = readFileSync(join(ctx.root, rel), 'utf8').match(/export\s+const\s+meta\s*=\s*\{[^]*?\bname:\s*['"]([^'"]+)['"]/);
      if (meta) map.get(byDir.get(m[1])).names.add(meta[1]);
    }
  }
  return new Map([...map].map(([n, v]) => [n, v.names]));
}

export function runDrift(opts) {
  const root = opts.root;
  const files = walk(root);
  const fileSet = new Set(files);
  const dirSet = new Set();
  for (const f of files) {
    let d = posix.dirname(f);
    while (d && d !== '.' && !dirSet.has(d)) {
      dirSet.add(d);
      d = posix.dirname(d);
    }
  }
  const catalog = loadCatalog(root);
  const plugins = catalog?.plugins ?? [];
  const npmScripts = new Set();
  for (const f of files) {
    if (f !== 'package.json' && !/^(?:site|mods)\/(?:[^/]+\/)*package\.json$/.test(f)) continue;
    try {
      for (const k of Object.keys(JSON.parse(readFileSync(join(root, f), 'utf8')).scripts ?? {})) npmScripts.add(k);
    } catch {
      // нечитаемый package.json судит npm
    }
  }
  const todayMs = opts.today ? Date.parse(`${opts.today}T00:00:00Z`) : Date.now();
  const ctx = {
    root, files, fileSet, dirSet, catalog, plugins, npmScripts,
    catalogNames: new Set(plugins.map((p) => p.name)),
    removedNames: removedNames(root),
    indexCache: new Map(),
    staleDays: opts.staleDays,
    todayMs,
    checkBareNames: false,
    stats: { a: { checked: 0, broken: 0 }, b: { checked: 0, broken: 0 }, c: { checked: 0, broken: 0 }, d: { checked: 0, broken: 0 } },
  };
  ctx.artifactMap = buildArtifactMap(ctx);
  ctx.groupStats = {};
  const findings = [];
  const only = new Set(opts.only);

  for (const rel of files) {
    if (isExcluded(rel)) continue;
    const group = groupOf(rel);
    if (!group) continue;
    const text = readFileSync(join(root, rel), 'utf8');
    const before = { a: ctx.stats.a.checked, b: ctx.stats.b.checked, ab: ctx.stats.a.broken, bb: ctx.stats.b.broken };
    if (only.has('b')) checkSectionRefs(ctx, rel, text, findings);
    if (only.has('a') && group !== 'tools' && catalog && npmScripts.size) checkCodeSpans(ctx, rel, text, findings);
    const gs = (ctx.groupStats[group] ??= { checked: 0, broken: 0 });
    gs.checked += ctx.stats.a.checked - before.a + (ctx.stats.b.checked - before.b);
    gs.broken += ctx.stats.a.broken - before.ab + (ctx.stats.b.broken - before.bb);
  }
  if (only.has('c')) checkNumbers(ctx, findings);
  if (only.has('d')) checkFreshness(ctx, findings);
  const uniq = new Map(findings.map((f) => [`${f.category}|${f.file}|${f.line}|${f.message}`, f]));
  findings.length = 0;
  findings.push(...uniq.values());
  findings.sort((x, y) => x.category.localeCompare(y.category) || x.file.localeCompare(y.file) || x.line - y.line);
  return { findings, stats: ctx.stats, groupStats: ctx.groupStats, staleDays: opts.staleDays, today: new Date(todayMs).toISOString().slice(0, 10) };
}

const TITLES = {
  a: '(а) пути и идентификаторы в code-span не существуют',
  b: '(б) разделы документов, на которые ссылаются, не существуют',
  c: '(в) числа расходятся с marketplace.json',
  d: '(г) сверка старше порога (сигнал, не ошибка)',
};

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`check-drift: ${e.message}`);
    process.exit(2);
  }
  const result = runDrift(opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const cat of ['a', 'b', 'c', 'd']) {
      if (!opts.only.includes(cat)) continue;
      const list = result.findings.filter((f) => f.category === cat);
      const s = result.stats[cat];
      console.log(`\n${TITLES[cat]}: ${list.length} (проверено ${s.checked})`);
      for (const f of list) console.log(`  ${f.file}:${f.line}  ${f.message}`);
    }
    console.log(`\nпорог сверки ${result.staleDays} дн., дата отсчёта ${result.today}`);
  }
  const hard = result.findings.some((f) => f.category !== 'd');
  const soft = result.findings.some((f) => f.category === 'd');
  process.exit(hard || (opts.strict && soft) ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
