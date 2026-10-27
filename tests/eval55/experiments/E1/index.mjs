// E1 - абляция разделов корневого файла: полный / без каждого раздела H2 / пустой.
// Гипотеза: обзорные разделы не влияют на решаемость, но стоят шагов и денег (R01, R03).
// Среда - копия репозитория на коммите прогона (git archive); корневой файл условий читается с него же; `.claude/rules/` остаются на месте. Дорогой эксперимент:
// одна ячейка - сессия с инструментами на крупном дереве. Кейсов 10: две правки по описанию (redis-keyword, redis-trap),
// одна правка команды с версией и семь починок засеянных нарушений, проверка каждого - команда валидатора или синхронизации (`cmd`), а не текст ответа.
// Засев делает prepare в песочнице; перед кейсом проверено, что без правки его `cmd` падает.
import { readFileSync, writeFileSync, appendFileSync, rmSync, mkdtempSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootNorm, exportAt } from '../../lib/repo.mjs';

const SKILL = 'plugins/skills/dex-skill-redis/skills/redis/SKILL.md';
const REDIS_PJ = 'plugins/skills/dex-skill-redis/.claude-plugin/plugin.json';
const AGENT = 'plugins/specialists/delivery/dex-bug-fixer/agents/bug-fixer.md';
const CLI_CMD = 'plugins/utilities/dex-redis-cli/commands/redis-info.md';
const CLI_PJ = 'plugins/utilities/dex-redis-cli/.claude-plugin/plugin.json';
const VALIDATE_SKILLS = { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] };
const SYNC = { type: 'cmd', id: 'marketplace-in-sync', run: ['node', 'tools/sync-marketplace.js', '--check'] };
const KEPT = { type: 'file-matches', id: 'checklist-kept', path: SKILL, regex: 'Старт сервиса при недоступном Redis' };
// Засев нарушения в песочнице: подмена фрагмента с проверкой наличия (иначе кейс молча перестал бы сеять).
const sub = (path, from, to) => (dir) => {
  const p = join(dir, path); const t = readFileSync(p, 'utf8');
  if (!t.includes(from)) throw new Error(`prepare: нет фрагмента в ${path}: ${from}`);
  writeFileSync(p, t.replace(from, to));
};
const add = (path, text) => (dir) => appendFileSync(join(dir, path), text);

function sections(md) { // [{title, start, end}] по заголовкам H2; вне fence
  const lines = md.split('\n');
  const marks = [];
  let fence = false;
  lines.forEach((l, i) => { if (l.startsWith('```')) fence = !fence; if (!fence && /^## /.test(l)) marks.push(i); });
  return marks.map((s, k) => ({ title: lines[s].slice(3).trim(), start: s, end: k + 1 < marks.length ? marks[k + 1] : lines.length }));
}


// Составные условия: разделы и абзацы находятся по префиксу текста. Нет фрагмента на коммите - ошибка, а не молчаливо другой состав
// (переименованный раздел иначе превратил бы условие в `full`).
const dropSection = (lines, titlePrefix) => {
  const s = sections(lines.join('\n')).find((x) => x.title.startsWith(titlePrefix));
  if (!s) throw new Error(`E1: нет раздела H2 «${titlePrefix}» на коммите`);
  return [...lines.slice(0, s.start), ...lines.slice(s.end)];
};
const blockAt = (lines, prefix) => { // [i, j): сплошной блок непустых строк, начинающийся с prefix, и пустая строка за ним
  const i = lines.findIndex((l) => l.startsWith(prefix));
  if (i < 0) throw new Error(`E1: нет абзаца «${prefix}» на коммите`);
  let j = i; while (j < lines.length && lines[j].trim() !== '') j++;
  return [i, lines[j] === '' ? j + 1 : j];
};
const dropBlock = (lines, prefix) => { const [i, j] = blockAt(lines, prefix); return [...lines.slice(0, i), ...lines.slice(j)]; };

// Обзорные единицы: выводятся из дерева либо дублируют указатели (рубрика 5.5, категории О и Д). Абзацы, несущие невыводимое (тип skill, bundle.json,
// размещение скилла и команды, практические правила композиции), остаются: условие снимает обзор, а не раздел целиком.
const OVERVIEW_SECTIONS = ['Уровень продукта'];
const OVERVIEW_BLOCKS = ['Полный перечень плагинов', 'Все плагины: ', 'Проверено по официальной документации', '| Путь |'];
const noOverview = (md) => {
  let L = md.split('\n');
  for (const t of OVERVIEW_SECTIONS) L = dropSection(L, t);
  for (const b of OVERVIEW_BLOCKS) L = dropBlock(L, b);
  return L.join('\n');
};

// Минимальный корень: шапка, «Конвенции», практические правила композиции и пять единиц чек-листа, которых нет ни в валидаторе, ни в другом доме.
const MINIMAL_KEEP = ['- **Нормативная единица пишется', '- **Пунктуация в артефактах', '- **Имя артефакта в теле', '- **Документ каталога из тела', '- **Адрес документа каталога из README'];
const minimal = (md) => {
  const L = md.split('\n');
  const secs = sections(md);
  const get = (t) => { const s = secs.find((x) => x.title.startsWith(t)); if (!s) throw new Error(`E1: нет раздела H2 «${t}» на коммите`); return L.slice(s.start, s.end); };
  const trim = (a) => { while (a.length && a[a.length - 1].trim() === '') a = a.slice(0, -1); return a; };
  const comp = get('Механизмы композиции');
  const rules = comp.findIndex((l) => l.startsWith('**Практические правила:**'));
  if (rules < 0) throw new Error('E1: нет блока «Практические правила» в разделе композиции');
  const chk = get('Чек-лист');
  const h3 = chk.findIndex((l) => l.startsWith('### Принципы содержания'));
  if (h3 < 0) throw new Error('E1: нет «Принципы содержания» в чек-листе');
  const bullets = MINIMAL_KEEP.map((p) => { const b = chk.find((l) => l.startsWith(p)); if (!b) throw new Error(`E1: нет единицы «${p}» в чек-листе`); return b; });
  const out = [...trim(L.slice(0, secs[0].start)), '', ...trim(get('Конвенции')), '', comp[0], '', ...trim(comp.slice(rules)), '', chk[0], '', chk[h3], '', ...bullets, ''];
  return out.join('\n');
};

// Пара к `full` для перечня имён: `.claude/rules/terminology.md` (грузится каждую сессию, генерируется из словаря) заменён указателем.
// `sync-terminology --check` в такой песочнице красный по построению: кейсы, чьи проверки его зовут, условие искажают (в проверках E1 его нет).
const TERMINOLOGY_FILE = '.claude/rules/terminology.md';
const TERMINOLOGY_POINTER = '# Термины каталога\n\nСловарь имён корпуса - docs/domain/domain-model.md.\n';

const cases = [
  { id: 'redis-keyword', prompt: 'Добавь ключевое слово Redlock в description skill redis (plugins/skills/dex-skill-redis) и доведи изменения до состояния, готового к коммиту.',
    graders: [
      { type: 'file-matches', id: 'keyword', path: SKILL, regex: 'Redlock' },
      { type: 'file-matches', id: 'version-bumped', path: 'plugins/skills/dex-skill-redis/.claude-plugin/plugin.json', regex: '"version":\\s*"1\\.2\\.2"' },
      { type: 'cmd', id: 'marketplace-in-sync', run: ['node', 'tools/sync-marketplace.js', '--check'] },
      { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] },
    ] },
  { id: 'redis-trap', prompt: `В ${SKILL} добавь в конец чек-листа пункт про забытый TTL у кэш-ключей: ситуация и чем кончится, в формате остальных пунктов. Остальное не трогай.`,
    graders: [
      { type: 'file-matches', id: 'trap-added', path: SKILL, regex: '^- .*TTL', flags: 'mu' },
      { type: 'file-not-matches', id: 'ascii-punctuation', path: SKILL, regex: '[\\u2013\\u2014]' },
      { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] },
    ] },
  { id: 'fix-docs-link', seed: add(SKILL, '\nФорма пункта описана в docs/SKILL_FRAMEWORK.md.\n'),
    prompt: 'Валидация skills падает на skill redis. Найди причину и исправь, остальное в skill не трогай.',
    graders: [VALIDATE_SKILLS, KEPT, { type: 'file-not-matches', id: 'link-gone', path: SKILL, regex: 'docs/' }] },
  { id: 'fix-link-escapes', seed: add(SKILL, '\nСм. также [kafka](../../../dex-skill-kafka/skills/kafka/SKILL.md).\n'),
    prompt: 'Валидация skills падает на skill redis. Найди причину и исправь, остальное в skill не трогай.',
    graders: [VALIDATE_SKILLS, KEPT, { type: 'file-not-matches', id: 'link-gone', path: SKILL, regex: '\\.\\./' }] },
  { id: 'fix-keywords-field', seed: sub(SKILL, 'name: redis\n', 'name: redis\nkeywords: [ttl, lock]\n'),
    prompt: 'Валидация skills падает на skill redis. Найди причину и исправь, остальное в skill не трогай.',
    graders: [VALIDATE_SKILLS, KEPT, { type: 'file-matches', id: 'description-kept', path: SKILL, regex: '^description: .*Активируется при', flags: 'mu' }] },
  { id: 'fix-bundle-closure', seed: add(SKILL, '- Профилирование памяти разбирай через `dex-skill-perf-profiling:perf-profiling`\n'),
    prompt: 'Валидация бандлов падает: skill redis называет артефакт, которого нет в составе. Исправь, остальное не трогай.',
    graders: [{ type: 'cmd', id: 'bundles-valid', run: ['node', 'tools/validate-bundle.js', 'all'] }, KEPT] },
  { id: 'fix-agent-field', seed: sub(AGENT, 'model: opus\n', 'model: opus\nallowed-tools: Read, Grep\n'),
    prompt: 'Валидация агентов падает на bug-fixer. Найди причину и исправь, остальное в агенте не трогай.',
    graders: [{ type: 'cmd', id: 'agents-valid', run: ['node', 'tools/validate-agent.js', 'all'] }, { type: 'file-matches', id: 'tools-kept', path: AGENT, regex: '^tools: Read, Edit, Write, Bash', flags: 'mu' }] },
  { id: 'fix-ousted-name', seed: add(SKILL, '- Проверку TTL повторяй на каждом раунде правок\n'),
    prompt: 'Валидация терминологии падает на skill redis. Найди причину и исправь по правилам каталога.',
    graders: [{ type: 'cmd', id: 'terminology-valid', run: ['node', 'tools/validate-terminology.js'] }, KEPT, { type: 'file-matches', id: 'item-kept', path: SKILL, regex: 'TTL' }] },
  { id: 'sync-after-version', seed: sub(REDIS_PJ, '"version": "1.2.1"', '"version": "1.2.5"'),
    prompt: 'В plugin.json skill redis версия уже поднята вручную. Доведи каталог до согласованного состояния, остальное не трогай.',
    graders: [SYNC, { type: 'file-matches', id: 'version-kept', path: REDIS_PJ, regex: '"version":\\s*"1\\.2\\.5"' }] },
  { id: 'command-description', prompt: 'В команде redis-info замени description на «Состояние Redis-сервера через INFO, только чтение» и доведи изменения до состояния, готового к коммиту.',
    graders: [
      { type: 'file-matches', id: 'description-changed', path: CLI_CMD, regex: 'только чтение' },
      { type: 'file-matches', id: 'version-bumped', path: CLI_PJ, regex: '"version":\\s*"1\\.0\\.5"' },
      SYNC,
      { type: 'cmd', id: 'commands-valid', run: ['node', 'tools/validate-command.js', 'all'] },
    ] },
];

function buildConditions(md) {
  const secs = sections(md);
  const conds = [
    { id: 'full', prepare() {} },
    { id: 'empty', prepare(dir) { for (const f of ['AGENTS.md', 'CLAUDE.md']) rmSync(join(dir, f), { force: true }); } },
    ...secs.map((s, k) => ({
      id: `minus-s${String(k + 1).padStart(2, '0')}`,
      title: s.title,
      prepare(dir) { const L = md.split('\n'); writeFileSync(join(dir, 'AGENTS.md'), [...L.slice(0, s.start), ...L.slice(s.end)].join('\n')); },
    })),
    { id: 'no-overview', title: 'без обзорных единиц', prepare(dir) { writeFileSync(join(dir, 'AGENTS.md'), noOverview(md)); } },
    { id: 'minimal', title: 'минимальный корень', prepare(dir) { writeFileSync(join(dir, 'AGENTS.md'), minimal(md)); } },
    { id: 'terminology-pointer', title: 'terminology.md - указатель', prepare(dir) { writeFileSync(join(dir, TERMINOLOGY_FILE), TERMINOLOGY_POINTER); } },
  ];
  return { conds };
}

// Проверка условий без модели: каждое условие применяется к копии трёх файлов коммита (AGENTS.md, CLAUDE.md, terminology.md) и даёт ожидаемый состав.
function checkConditions(commit) {
  const problems = [];
  const src = exportAt(commit, ['AGENTS.md', 'CLAUDE.md', TERMINOLOGY_FILE]);
  const md = rootNorm(commit);
  const secs = sections(md);
  const { conds } = buildConditions(md);
  const size = (d, f = 'AGENTS.md') => (existsSync(join(d, f)) ? readFileSync(join(d, f), 'utf8') : null);
  const sizes = {};
  for (const c of conds) {
    const d = mkdtempSync(join(tmpdir(), 'eval55-e1-'));
    try {
      cpSync(src, d, { recursive: true });
      c.prepare(d);
      const t = size(d); sizes[c.id] = t;
      const m = /^minus-s(\d+)$/.exec(c.id);
      if (c.id === 'full' && t !== md) problems.push('full: AGENTS.md изменён');
      else if (c.id === 'empty' && (t !== null || size(d, 'CLAUDE.md') !== null)) problems.push('empty: корневые файлы на месте');
      else if (m) {
        const s = secs[Number(m[1]) - 1];
        if (t === null || t.includes(`## ${s.title}`) || t.length >= md.length) problems.push(`${c.id}: раздел «${s.title}» не снят`);
      } else if (c.id === 'terminology-pointer') {
        const p = size(d, TERMINOLOGY_FILE);
        if (p !== TERMINOLOGY_POINTER || t !== md) problems.push('terminology-pointer: указатель не записан либо тронут AGENTS.md');
      }
    } catch (e) { problems.push(`${c.id}: ${e.message}`); } finally { rmSync(d, { recursive: true, force: true }); }
  }
  const no = sizes['no-overview']; const mn = sizes.minimal;
  if (no && !(no.length < md.length && !no.includes('## Уровень продукта') && no.includes('## Конвенции') && no.includes('**Практические правила:**') && no.includes('**Скилл, потребители которого'))) problems.push('no-overview: состав не тот');
  if (mn && !(no && mn.length < no.length && mn.includes('## Конвенции') && !mn.includes('## Каталог плагинов') && MINIMAL_KEEP.every((p) => mn.includes(p)))) problems.push('minimal: состав не тот');
  return problems;
}

export default {
  id: 'E1',
  title: 'Абляция разделов корневого файла',
  kind: 'repo',
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  allow: ['Bash(node *)', 'Bash(npm run *)', 'Bash(git diff*)', 'Bash(git status*)'],
  baseline: 'full',
  // Состав корневого файла и разделов-условий берётся с коммита прогона (`commit`), тем же, из которого собрана песочница.
  build({ commit = 'HEAD' } = {}) {
    const { conds } = buildConditions(rootNorm(commit));
    return conds.flatMap((c) => cases.map((k) => ({
      cond: c.id, condTitle: c.title, case: k.id, fixture: 'repo', prompt: k.prompt, graders: k.graders, solve: k.solve, control: k.control,
      prepare(dir) { c.prepare(dir); k.seed?.(dir); },
    })));
  },
  check: ({ commit }) => checkConditions(commit),
};
