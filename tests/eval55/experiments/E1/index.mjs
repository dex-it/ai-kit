// E1 - абляция разделов корневого файла: полный / без каждого раздела H2 / пустой.
// Гипотеза: обзорные разделы не влияют на решаемость, но стоят шагов и денег (R01, R03).
// Среда - копия репозитория на коммите прогона (git archive); `.claude/rules/` остаются на месте. Дорогой эксперимент:
// одна ячейка - сессия с инструментами на крупном дереве. Кейсов 10: две правки по описанию (redis-keyword, redis-trap),
// одна правка команды с версией и семь починок засеянных нарушений, проверка каждого - команда валидатора или синхронизации (`cmd`), а не текст ответа.
// Засев делает prepare в песочнице; перед кейсом проверено, что без правки его `cmd` падает.
import { readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
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

export default {
  id: 'E1',
  title: 'Абляция разделов корневого файла',
  kind: 'repo',
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  allow: ['Bash(node *)', 'Bash(npm run *)', 'Bash(git diff*)', 'Bash(git status*)'],
  baseline: 'full',
  build() {
    const md = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const secs = sections(md);
    const conds = [
      { id: 'full', prepare() {} },
      { id: 'empty', prepare(dir) { for (const f of ['AGENTS.md', 'CLAUDE.md']) rmSync(join(dir, f), { force: true }); } },
      ...secs.map((s, k) => ({
        id: `minus-s${String(k + 1).padStart(2, '0')}`,
        title: s.title,
        prepare(dir) { const L = md.split('\n'); writeFileSync(join(dir, 'AGENTS.md'), [...L.slice(0, s.start), ...L.slice(s.end)].join('\n')); },
      })),
    ];
    return conds.flatMap((c) => cases.map((k) => ({
      cond: c.id, condTitle: c.title, case: k.id, fixture: 'repo', prompt: k.prompt, graders: k.graders,
      prepare(dir) { c.prepare(dir); k.seed?.(dir); },
    })));
  },
};
