#!/usr/bin/env node
/**
 * Замер контекстной стоимости каталога: постоянный слой, предзагрузка skills, срез по группам.
 *
 * Это измерение, не валидатор: порогов и кодов возврата «нарушено» нет, правила в реестр валидаторов
 * не заводятся. Порог задаёт сабзадача, которая сравнивает два замера (`--diff`).
 *
 * Мера - байты, строки и знаки (кодовые точки), не токены: локального токенайзера нет, а смешанный
 * русско-английский текст разъезжается по коэффициенту. Кириллица занимает 2 байта, поэтому знаки и
 * байты считаются оба. Строки считаются как в `wc -l` (число `\n`; последняя строка без `\n` тоже строка).
 *
 * Постоянный слой - то, что грузится в каждую сессию или каждому субагенту: корневые `CLAUDE.md` и
 * `AGENTS.md`, правила без `paths`, `description` всех skills, агентов и команд, skills из `skills:`
 * во frontmatter агента (инъекция полного `SKILL.md` при старте), системные промты лаунчера.
 * Слой по вызову (тело skill, правила с `paths`, `references/`) считается отдельно и в сумму не входит.
 *
 * Usage:
 *   node tools/measure-context.js                  # таблицы Markdown
 *   node tools/measure-context.js --json           # машинный вывод (вход для --diff)
 *   node tools/measure-context.js --top=5          # крупнейших файлов на группу (по умолчанию 3)
 *   node tools/measure-context.js --diff a.json b.json
 *   node tools/measure-context.js --prohibitions [--list] [--json]  # слова-запреты по областям; --list - каждое вхождение
 */

import { readdirSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Группы по предмету, не по плагину. Состав - единственное место списка; skill или агент вне групп попадает в `ungrouped`.
const SKILL_GROUPS = {
  'S1 Контекст проекта и нормы репозитория': ['codebase-conventions', 'project-baseline', 'project-docs-map', 'docs-layout', 'stack-registry', 'ci-gates', 'issue-tracking', 'legacy-reconstruction', 'completeness-mapping', 'artifact-naming', 'unit-identity', 'project-rulebook', 'rule-mining', 'rulebook-quality'],
  'S2 Мета-нормы: письмо, ревью артефактов, делегирование': ['node-contract', 'norm-writing', 'optimize-for-llm', 'artifact-review', 'fact-verification', 'subagent-dispatch', 'decision-log', 'do'],
  'S3 Требования, продукт и планирование': ['business-analysis-29148', 'system-requirements-29148', 'functional-requirements', 'nfr', 'requirement-quality', 'requirement-set-quality', 'use-cases-cockburn', 'use-case-quality', 'user-stories', 'bdd-gherkin', 'idea-forming', 'opportunity-canvas', 'product-discovery', 'prioritization', 'epic-planning', 'implementation-plan', 'plan-quality', 'verification-planning-29119'],
  'S4 Архитектура, API и проектирование': ['ddd', 'solid', 'adr-quality', 'architecture-definition-42010', 'design-quality', 'integration-boundary', 'interface-definition-openapi', 'api-documentation', 'api-spec-quality', 'scalability', 'observability', 'doc-standards'],
  'S5 Ревью, качество и тесты': ['review-evidence', 'review-step-by-step', 'review-threads', 'defect-classification', 'performance-review', 'post-merge-remediation', 'test-coverage', 'testability', 'merge-conflict-resolution'],
  'S6 Отладка и диагностика': ['root-cause-analysis', 'bug-reproduction', 'managed-debug', 'native-debug', 'core-dumps', 'syscall-tracing', 'perf-profiling', 'binary-inspection', 'change-correlation', 'shared-stand-safety', 'stand-verification'],
  'S7 .NET': ['dotnet-api-development', 'dotnet-async-patterns', 'dotnet-code-quality', 'dotnet-csproj-hygiene', 'dotnet-ef-core', 'dotnet-logging', 'dotnet-resilience', 'dotnet-testing-patterns', 'dotnet-validation'],
  'S8 TypeScript, веб и автоматизация тестов': ['ts-nodejs-api', 'ts-vitest-jest', 'react', 'playwright', 'api-testing'],
  'S9 Python и ML': ['python-computer-vision', 'python-ml-optimization', 'python-nlp-transformers', 'python-project-hygiene', 'python-pytorch', 'python-tensorflow'],
  'S10 Инфраструктура и CI/CD': ['kafka', 'rabbitmq', 'redis', 'mongodb', 'elasticsearch', 'kubernetes', 'github-actions', 'gitlab-ci', 'jenkins', 'teamcity'],
};

const AGENT_GROUPS = {
  'A1 Ревью': ['mr-reviewer', 'mr-check-reviewer', 'self-reviewer', 'design-reviewer', 'stand-reviewer', 'security-reviewer', 'requirements-reviewer', 'review-planner'],
  'A2 Требования, продукт, аналитика': ['business-requirements-analyst', 'requirements-analyst', 'usecase-analyst', 'use-case-writer', 'user-story-analyst', 'bdd-author', 'domain-analyst', 'process-modeler', 'backlog-manager', 'roadmap-planner', 'metrics-analyst', 'implementer-reader'],
  'A3 Архитектура, API, документы': ['architect', 'architect-dotnet', 'adr-writer', 'api-designer', 'diagram-creator', 'doc-writer'],
  'A4 Реализация и тесты': ['dotnet-coder', 'ts-fullstack-assistant', 'dotnet-test-writer', 'ts-test-writer', 'test-automator', 'test-analyst', 'dotnet-ef-specialist'],
  'A5 Баги и диагностика': ['bug-finder', 'bug-fixer', 'bug-reporter', 'debugger', 'incident-investigator', 'discover-reviewer', 'discover-orchestrator', 'dotnet-performance-analyst', 'dotnet-quality-auditor', 'dotnet-runtime-diagnostician', 'model-debugger'],
  'A6 DevOps и инфраструктура': ['github-actions-specialist', 'gitlab-ci-specialist', 'jenkins-specialist', 'teamcity-specialist', 'docker-specialist', 'kubernetes-specialist', 'kafka-specialist', 'rabbitmq-specialist', 'redis-specialist', 'postgresql-specialist', 'mongodb-specialist', 'elasticsearch-specialist', 'seq-logging-specialist', 'grafana-specialist', 'data-pipeline-builder'],
  'A7 ML': ['deployment-assistant', 'ml-experimenter', 'model-trainer'],
  'A8 Автономная работа и добыча правил': ['scaffolder', 'goal-reader', 'reviewer', 'skeptic', 'rulebook-orchestrator', 'rule-collector', 'coder', 'corpus-checker', 'deliverer', 'designer', 'onboarder', 'recorder'],
};

// Слова-запреты, капс, просьбы перепроверки: приближённый признак стиля, не оценка качества. Границы слова - по \p{L},
// потому что \b в JS не знает кириллицы.
const W = '[\\p{L}\\p{N}_]';
const word = (alt, flags) => new RegExp(`(?<!${W})(?:${alt})(?!${W})`, flags);
const PROHIBITION = word(`нельзя|запрещ${W}*|не\\s+(?:делай|добавляй|пиши|трогай|меняй|правь|создавай)|никогда|ни\\s+в\\s+коем`, 'giu');
const CAPS = word('ВСЕГДА|НИКОГДА|ОБЯЗАТЕЛЬНО|КРИТИЧНО|ЗАПРЕЩЕНО|MUST|NEVER|ALWAYS', 'gu');
const VERIFY_ASK = word(`перепроверь${W}*|проверь\\s+ещё\\s+раз|убедись|double-?check|re-?verify|перечитай${W}*\\s+(?:ещё|заново)`, 'giu');
const DASHES = /[\u2013\u2014]/g;

function git(args) {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

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
const read = (p) => readFileSync(p, 'utf8');
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const chars = (s) => Array.from(s).length;
const lines = (s) => (s === '' ? 0 : s.split('\n').length - (s.endsWith('\n') ? 1 : 0));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const kb = (n) => Math.round(n / 1024);
const kb1 = (n) => (Math.round((n / 1024) * 10) / 10).toString().replace('.', ',');

function parse(text) {
  try {
    const m = matter(text, {});
    return { data: m.data || {}, body: m.content };
  } catch {
    return { data: {}, body: text };
  }
}

// Длинные предложения: предложение - не менее 3 слов; код и строки таблиц в счёт не идут.
// Границу задаёт строка Markdown, а не точка: заголовок без точки, пункт списка и строка с меткой
// ("Плохо:", "Правильно:", "Почему:") - отдельные блоки; строка с жёстким переносом, продолжающая
// незаконченную фразу, приклеивается к предыдущей.
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;
const LABEL = /^\p{Lu}[^\s:]{0,30}(?: [^\s:]+){0,2}:\s/u;
function proseBlocks(body) {
  const blocks = [];
  let cur = null;
  const flush = () => { if (cur !== null) blocks.push(cur); cur = null; };
  for (const raw of body.replace(/```[\s\S]*?```/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || /^#{1,6}\s/.test(line) || /\|.*\|/.test(line)) { flush(); continue; }
    const item = LIST_ITEM.test(line);
    const text = line.replace(LIST_ITEM, '').replace(/^>\s*/, '');
    if (cur !== null && !item && !LABEL.test(text) && !/[.!?]$/.test(cur)) cur += ` ${text}`;
    else { flush(); cur = text; }
  }
  flush();
  return blocks;
}
function sentenceStats(body) {
  const sents = proseBlocks(body).flatMap((b) => b.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)).filter((s) => s.split(' ').filter(Boolean).length >= 3);
  const lens = sents.map((s) => s.split(' ').filter(Boolean).length);
  return { sentences: lens.length, long: lens.filter((n) => n > 25).length };
}

function measureFile(path) {
  const text = read(path);
  const { data, body } = parse(text);
  const description = typeof data.description === 'string' ? data.description.replace(/\s+/g, ' ').trim() : '';
  const ss = sentenceStats(body);
  return {
    path: rel(path),
    bytes: bytes(text),
    chars: chars(text),
    lines: lines(text),
    descChars: chars(description),
    descBytes: bytes(description),
    prohibitions: (body.match(PROHIBITION) || []).length,
    caps: (body.match(CAPS) || []).length,
    verifyAsks: (body.match(VERIFY_ASK) || []).length,
    dashes: (text.match(DASHES) || []).length,
    sentences: ss.sentences,
    longSentences: ss.long,
    model: data.model ?? null,
    effort: data.effort ?? null,
    skills: Array.isArray(data.skills) ? data.skills : data.skills ? [data.skills] : [],
  };
}

function aggregate(rows) {
  if (!rows.length) return { n: 0 };
  const B = sum(rows.map((r) => r.bytes));
  const sents = sum(rows.map((r) => r.sentences));
  return {
    n: rows.length,
    bytes: B,
    chars: sum(rows.map((r) => r.chars)),
    lines: sum(rows.map((r) => r.lines)),
    maxBytes: Math.max(...rows.map((r) => r.bytes)),
    descCharsTotal: sum(rows.map((r) => r.descChars)),
    descCharsMax: Math.max(...rows.map((r) => r.descChars)),
    prohibitions: sum(rows.map((r) => r.prohibitions)),
    prohibitionsPerKb: Math.round((sum(rows.map((r) => r.prohibitions)) / (B / 1024)) * 100) / 100,
    caps: sum(rows.map((r) => r.caps)),
    verifyAsks: sum(rows.map((r) => r.verifyAsks)),
    dashes: sum(rows.map((r) => r.dashes)),
    longSentencePct: sents ? Math.round((100 * sum(rows.map((r) => r.longSentences))) / sents) : 0,
  };
}

const skillName = (ref) => String(ref).split(':').pop();

function collect() {
  const files = walk(join(REPO_ROOT, 'plugins'));
  const skillFiles = files.filter((f) => basename(f) === 'SKILL.md');
  const agentFiles = files.filter((f) => /\/agents\/[^/]+\.md$/.test(f.split('\\').join('/')));
  const commandFiles = files.filter((f) => /\/commands\/[^/]+\.md$/.test(f.split('\\').join('/')));

  const skills = skillFiles.map((f) => {
    const m = measureFile(f);
    const dir = dirname(f);
    const refs = walk(join(dir, 'references'));
    m.name = basename(dir);
    m.refsBytes = sum(refs.map((r) => bytes(read(r))));
    m.refsFiles = refs.length;
    return m;
  });
  const agents = agentFiles.map((f) => ({ ...measureFile(f), name: basename(f, '.md') }));
  const commands = commandFiles.map((f) => ({ ...measureFile(f), name: basename(f, '.md') }));

  const trapDir = join(REPO_ROOT, 'tests/trap-skills');
  const trapSets = new Set(existsSync(trapDir) ? readdirSync(trapDir).filter((d) => lstatSync(join(trapDir, d)).isDirectory()) : []);

  return { skills, agents, commands, trapSets };
}

function groupTable(items, groups, top, extra) {
  const byName = new Map();
  for (const it of items) (byName.get(it.name) || byName.set(it.name, []).get(it.name)).push(it);
  const used = new Set();
  const out = Object.entries(groups).map(([title, names]) => {
    const rows = names.flatMap((n) => byName.get(n) || []);
    names.forEach((n) => used.add(n));
    const missing = names.filter((n) => !byName.has(n));
    return {
      group: title,
      ...aggregate(rows),
      missing,
      largest: [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, top).map((r) => ({ name: r.name, bytes: r.bytes })),
      ...extra(rows),
    };
  });
  return { groups: out, ungrouped: [...byName.keys()].filter((n) => !used.has(n)).sort() };
}

function measure(top) {
  const { skills, agents, commands, trapSets } = collect();
  const files = {};
  const addFile = (r) => { files[r.path] = { bytes: r.bytes, lines: r.lines }; };

  // --- постоянный слой ---
  const persistent = [];
  const addPersistent = (id, mode, paths) => {
    const real = paths.filter((p) => existsSync(p));
    if (!real.length) return;
    const texts = real.map((p) => ({ p, t: read(p) }));
    texts.forEach(({ p, t }) => { files[rel(p)] = { bytes: bytes(t), lines: lines(t) }; });
    persistent.push({ id, mode, files: real.length, lines: sum(texts.map(({ t }) => lines(t))), chars: sum(texts.map(({ t }) => chars(t))), bytes: sum(texts.map(({ t }) => bytes(t))) });
  };
  addPersistent('CLAUDE.md', 'always', [join(REPO_ROOT, 'CLAUDE.md')]);
  addPersistent('AGENTS.md', 'always', [join(REPO_ROOT, 'AGENTS.md')]);
  const ruleFiles = walk(join(REPO_ROOT, '.claude/rules')).filter((f) => f.endsWith('.md'));
  for (const f of ruleFiles) {
    const hasPaths = parse(read(f)).data.paths != null;
    addPersistent(rel(f), hasPaths ? 'paths' : 'always', [f]);
  }
  for (const f of walk(join(REPO_ROOT, 'run-claude')).filter((p) => /system-prompt[^/]*\.md$/.test(p))) addPersistent(rel(f), 'launcher', [f]);

  for (const [id, set] of [['description: skills', skills], ['description: агенты', agents], ['description: команды', commands]]) {
    persistent.push({ id, mode: 'listing', files: set.length, lines: 0, chars: sum(set.map((r) => r.descChars)), bytes: sum(set.map((r) => r.descBytes)), maxChars: Math.max(...set.map((r) => r.descChars)) });
  }

  // --- предзагрузка skills: полный SKILL.md на каждый запуск агента ---
  const skillByName = new Map(skills.map((s) => [s.name, s]));
  const preloadCount = new Map();
  for (const a of agents) for (const ref of a.skills) preloadCount.set(skillName(ref), (preloadCount.get(skillName(ref)) || 0) + 1);
  const preload = [...preloadCount.entries()].map(([name, n]) => {
    const s = skillByName.get(name);
    return { skill: name, agents: n, bytes: s ? s.bytes : null, refsBytes: s ? s.refsBytes : null, bytesAllAgents: s ? s.bytes * n : null, known: !!s };
  }).sort((a, b) => (b.bytesAllAgents ?? 0) - (a.bytesAllAgents ?? 0) || a.skill.localeCompare(b.skill));

  [...skills, ...agents, ...commands].forEach(addFile);
  for (const s of skills) if (s.refsBytes) files[`${dirname(s.path)}/references/*`] = { bytes: s.refsBytes, lines: 0 };

  const skillGroups = groupTable(skills, SKILL_GROUPS, top, (rows) => ({
    refsBytes: sum(rows.map((r) => r.refsBytes)),
    trapSets: rows.filter((r) => trapSets.has(r.name)).length,
  }));
  const agentGroups = groupTable(agents, AGENT_GROUPS, top, (rows) => ({
    models: Object.fromEntries([...new Set(rows.map((r) => r.model ?? '(нет)'))].sort().map((m) => [m, rows.filter((r) => (r.model ?? '(нет)') === m).length])),
    effort: Object.fromEntries([...new Set(rows.filter((r) => r.effort).map((r) => r.effort))].sort().map((e) => [e, rows.filter((r) => r.effort === e).length])),
    preloadNodeContract: rows.filter((r) => r.skills.some((s) => skillName(s) === 'node-contract')).length,
  }));

  const always = persistent.filter((r) => r.mode === 'always' || r.mode === 'listing');
  return {
    commit: git(['rev-parse', 'HEAD']),
    persistent: { rows: persistent, alwaysBytes: sum(always.map((r) => r.bytes)), alwaysChars: sum(always.map((r) => r.chars)), alwaysLines: sum(always.map((r) => r.lines)) },
    preload,
    skills: { total: aggregate(skills), ...skillGroups },
    agents: { total: aggregate(agents), ...agentGroups, withEffort: agents.filter((a) => a.effort).length },
    commands: { ...aggregate(commands), largest: [...commands].sort((a, b) => b.bytes - a.bytes).slice(0, top).map((r) => ({ name: r.name, bytes: r.bytes })), filesWithDashes: commands.filter((c) => c.dashes).length },
    files,
  };
}

// ---------- вывод ----------

const n = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i === 0 ? '---' : '---:')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

function render(m) {
  const o = [];
  o.push(`# Замер контекста каталога`, '', `Коммит: \`${m.commit ? m.commit.slice(0, 8) : 'не git-дерево'}\`. Мера - байты, строки, знаки; токены не оцениваются.`, '');
  o.push('## Постоянный слой', '');
  o.push(table(['Что', 'Режим', 'Файлов', 'Строк', 'Знаков', 'Байт'], m.persistent.rows.map((r) => [`\`${r.id}\``, r.mode, r.files, n(r.lines), n(r.chars), n(r.bytes)])));
  o.push('', `Режимы: \`always\` - каждая сессия и субагент; \`listing\` - только \`description\` в листинге; \`paths\` - по сопоставлению пути; \`launcher\` - системные промты \`run-claude\`. Сумма \`always\` и \`listing\`: ${n(m.persistent.alwaysLines)} строк, ${n(m.persistent.alwaysChars)} знаков, ${n(m.persistent.alwaysBytes)} байт.`, '');
  o.push('## Предзагрузка skills (`skills:` во frontmatter агента)', '');
  o.push(table(['Skill', 'Агентов', 'SKILL.md, байт', 'references, байт', 'За прогон всех агентов, байт'], m.preload.map((p) => [`\`${p.skill}\``, p.agents, p.known ? n(p.bytes) : 'нет в каталоге', p.known ? n(p.refsBytes) : '-', p.known ? n(p.bytesAllAgents) : '-'])));
  o.push('', `Итого за прогон всех предзагружающих агентов: ${n(sum(m.preload.map((p) => p.bytesAllAgents || 0)))} байт.`, '');
  const g = (title, block, cols, row) => {
    o.push(`## ${title}`, '');
    o.push(table(cols, [...block.groups.map(row), ...(block.total ? [row({ ...block.total, group: 'Итого', largest: [], missing: [] })] : [])]));
    if (block.ungrouped.length) o.push('', `**Вне групп:** ${block.ungrouped.join(', ')}`);
    const missing = block.groups.flatMap((x) => x.missing);
    if (missing.length) o.push('', `**В группах, но не найдены:** ${missing.join(', ')}`);
    o.push('');
  };
  const big = (x) => (x.largest.length ? x.largest.map((l) => `${l.name} ${kb1(l.bytes)}`).join(', ') : '-');
  g('Skills по группам', m.skills, ['Группа', 'Skills', 'КБ', 'Ср. КБ', 'references, КБ', 'description ср./макс.', 'Запретов/КБ', 'Капс', 'Просьб перепроверки', 'Длинных предл., %', 'Контрольные наборы', 'Крупнейшие, КБ'],
    (x) => [x.group, x.n, kb(x.bytes), kb1(x.bytes / x.n), kb(x.refsBytes ?? 0), `${Math.round(x.descCharsTotal / x.n)}/${x.descCharsMax}`, String(x.prohibitionsPerKb).replace('.', ','), x.caps, x.verifyAsks, x.longSentencePct, x.trapSets == null ? '-' : `${x.trapSets}/${x.n}`, big(x)]);
  g('Агенты по группам', m.agents, ['Группа', 'Агентов', 'КБ', 'Ср. КБ', 'description ср./макс.', 'Модели', 'effort', 'Предзагрузка node-contract', 'Крупнейшие, КБ'],
    (x) => [x.group, x.n, kb(x.bytes), kb1(x.bytes / x.n), `${Math.round(x.descCharsTotal / x.n)}/${x.descCharsMax}`, x.models ? Object.entries(x.models).map(([k, v]) => `${k} ${v}`).join(', ') : '-', x.effort && Object.keys(x.effort).length ? Object.entries(x.effort).map(([k, v]) => `${k} ${v}`).join(', ') : '-', x.preloadNodeContract ?? '-', big(x)]);
  const c = m.commands;
  o.push('## Команды', '', `${c.n} команд, ${n(c.bytes)} байт (${kb(c.bytes)} КБ, среднее ${kb1(c.bytes / c.n)} КБ); \`description\` в среднем ${Math.round(c.descCharsTotal / c.n)} знаков, максимум ${c.descCharsMax}. Длинное или среднее тире: ${c.dashes} вхождений в ${c.filesWithDashes} файлах. Крупнейшие, КБ: ${big(c)}.`, '');
  return o.join('\n');
}

// ---------- сравнение двух замеров ----------

function flatten(m) {
  const f = {};
  for (const r of m.persistent.rows) { f[`persistent ${r.id}: bytes`] = r.bytes; f[`persistent ${r.id}: lines`] = r.lines; f[`persistent ${r.id}: chars`] = r.chars; }
  f['persistent always+listing: bytes'] = m.persistent.alwaysBytes;
  f['persistent always+listing: lines'] = m.persistent.alwaysLines;
  for (const p of m.preload) f[`preload ${p.skill}: bytes all agents`] = p.bytesAllAgents ?? 0;
  f['preload total: bytes all agents'] = sum(m.preload.map((p) => p.bytesAllAgents || 0));
  for (const [kind, block] of [['skills', m.skills], ['agents', m.agents]]) for (const x of block.groups) { f[`${kind} ${x.group}: bytes`] = x.bytes ?? 0; f[`${kind} ${x.group}: lines`] = x.lines ?? 0; }
  f['commands: bytes'] = m.commands.bytes; f['commands: lines'] = m.commands.lines;
  return f;
}

function diff(aPath, bPath) {
  const a = JSON.parse(read(aPath));
  const b = JSON.parse(read(bPath));
  const fa = flatten(a);
  const fb = flatten(b);
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])];
  const rows = keys.filter((k) => (fa[k] ?? 0) !== (fb[k] ?? 0)).map((k) => {
    const x = fa[k] ?? 0; const y = fb[k] ?? 0;
    return [k, n(x), n(y), `${y - x > 0 ? '+' : ''}${n(y - x)}`, x ? `${y - x > 0 ? '+' : ''}${(((y - x) / x) * 100).toFixed(1)}%` : '-'];
  });
  const fileKeys = [...new Set([...Object.keys(a.files), ...Object.keys(b.files)])].sort();
  const fileRows = fileKeys.filter((k) => (a.files[k]?.bytes ?? 0) !== (b.files[k]?.bytes ?? 0) || (a.files[k]?.lines ?? 0) !== (b.files[k]?.lines ?? 0)).map((k) => {
    const x = a.files[k] ?? { bytes: 0, lines: 0 }; const y = b.files[k] ?? { bytes: 0, lines: 0 };
    return [`\`${k}\``, n(x.bytes), n(y.bytes), n(y.bytes - x.bytes), n(y.lines - x.lines)];
  });
  const o = [`# Разность замеров`, '', `\`${a.commit ? a.commit.slice(0, 8) : '?'}\` -> \`${b.commit ? b.commit.slice(0, 8) : '?'}\``, ''];
  o.push(rows.length ? table(['Показатель', 'До', 'После', 'Разность', '%'], rows) : 'Показатели не изменились.', '');
  o.push('## По файлам (байты и чистый прирост строк = добавлено минус удалено, как в `git diff --numstat`)', '');
  o.push(fileRows.length ? table(['Файл', 'Байт до', 'Байт после', 'Δ байт', 'Δ строк'], fileRows) : 'Файлы не изменились.');
  return o.join('\n');
}

// ---------- слова-запреты по областям (--prohibitions) ----------

// Область = тип файла, где слово стоит. Счёт по всему тексту файла (frontmatter включён), в отличие от `prohibitions`
// выше, который считает только тело. Категория слова нужна, чтобы отличать формы запрета друг от друга в таблице.
const PROHIBITION_KINDS = [
  ['нельзя', word('нельзя', 'giu')],
  ['запрещ*', word(`запрещ${W}*`, 'giu')],
  ['никогда', word('никогда', 'giu')],
  ['не делай и др.', word('не\\s+(?:делай|добавляй|пиши|трогай|меняй|правь|создавай)', 'giu')],
  ['ни в коем', word('ни\\s+в\\s+коем', 'giu')],
];
const DOCS_SKIP = /^docs\/(research|guide|superpowers|migration)\//;

function prohibitionArea(path) {
  const p = rel(path);
  if (!p.endsWith('.md')) return null;
  if (p.startsWith('plugins/')) {
    if (/\/agents\/[^/]+\.md$/.test(p)) return 'agents';
    if (/\/commands\/[^/]+\.md$/.test(p)) return 'commands';
    if (/\/SKILL\.md$/.test(p)) return 'skills';
    if (/\/skills\/[^/]+\/references\//.test(p)) return 'skills-references';
    return 'plugins-other';
  }
  if (p.startsWith('docs/')) return DOCS_SKIP.test(p) ? null : 'docs';
  if (p.startsWith('.claude/rules/')) return 'rules';
  if (!p.includes('/')) return 'root';
  return null;
}

const PROHIBITION_AREAS = ['agents', 'skills', 'skills-references', 'commands', 'plugins-other', 'docs', 'root', 'rules'];

function scanProhibitions() {
  const areas = Object.fromEntries(PROHIBITION_AREAS.map((a) => [a, { files: 0, filesWith: 0, total: 0, caps: 0, kinds: Object.fromEntries(PROHIBITION_KINDS.map(([k]) => [k, 0])) }]));
  const hits = [];
  const roots = ['plugins', 'docs', '.claude/rules'].map((d) => join(REPO_ROOT, d));
  const rootFiles = existsSync(REPO_ROOT) ? readdirSync(REPO_ROOT).map((f) => join(REPO_ROOT, f)).filter((f) => lstatSync(f).isFile()) : [];
  for (const f of [...rootFiles, ...roots.flatMap((d) => walk(d))].sort()) {
    const area = prohibitionArea(f);
    if (!area) continue;
    const a = areas[area];
    a.files += 1;
    let fileHits = 0;
    read(f).split('\n').forEach((line, i) => {
      const kinds = PROHIBITION_KINDS.map(([k, re]) => [k, (line.match(re) || []).length]).filter(([, c]) => c > 0);
      const caps = (line.match(CAPS) || []).length;
      a.caps += caps;
      if (!kinds.length) return;
      for (const [k, c] of kinds) { a.kinds[k] += c; a.total += c; fileHits += c; }
      hits.push({ area, path: rel(f), line: i + 1, kinds: kinds.map(([k]) => k), text: line.trim() });
    });
    if (fileHits) a.filesWith += 1;
  }
  return { commit: git(['rev-parse', 'HEAD']), areas, total: sum(Object.values(areas).map((a) => a.total)), hits };
}

function renderProhibitions(r, list) {
  const kinds = PROHIBITION_KINDS.map(([k]) => k);
  const o = ['# Слова-запреты по областям', '', `Коммит: \`${r.commit ? r.commit.slice(0, 8) : 'не git-дерево'}\`. Счёт вхождений слов целиком файла (регистр не важен); \`docs/\` без \`research/\`, \`guide/\`, \`superpowers/\`, \`migration/\`.`, ''];
  o.push(table(['Область', 'Файлов', 'С запретами', 'Всего', ...kinds, 'Капс'], [...PROHIBITION_AREAS.map((a) => { const x = r.areas[a]; return [a, x.files, x.filesWith, x.total, ...kinds.map((k) => x.kinds[k]), x.caps]; }),
    ['Итого', ...[ 'files', 'filesWith', 'total' ].map((k) => sum(Object.values(r.areas).map((x) => x[k]))), ...kinds.map((k) => sum(Object.values(r.areas).map((x) => x.kinds[k]))), sum(Object.values(r.areas).map((x) => x.caps))]]));
  if (list) o.push('', ...r.hits.map((h) => `${h.path}:${h.line}\t${h.kinds.join('+')}\t${h.text}`));
  return o.join('\n');
}

// ---------- CLI ----------

const argv = process.argv.slice(2);
if (argv.includes('--prohibitions')) {
  const r = scanProhibitions();
  console.log(argv.includes('--json') ? JSON.stringify(r, null, 2) : renderProhibitions(r, argv.includes('--list')));
} else if (argv[0] === '--diff') {
  if (argv.length !== 3) { console.error('Usage: measure-context.js --diff before.json after.json'); process.exit(2); }
  console.log(diff(argv[1], argv[2]));
} else {
  const topArg = argv.find((a) => a.startsWith('--top='));
  const top = topArg ? Math.max(0, parseInt(topArg.slice(6), 10) || 0) : 3;
  const m = measure(top);
  console.log(argv.includes('--json') ? JSON.stringify(m, null, 2) : render(m));
}
