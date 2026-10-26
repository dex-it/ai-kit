// E1 - абляция разделов корневого файла: полный / без каждого раздела H2 / пустой.
// Гипотеза: обзорные разделы не влияют на решаемость, но стоят шагов и денег (R01, R03).
// Среда - копия репозитория на коммите прогона (git archive); `.claude/rules/` остаются на месте. Дорогой эксперимент:
// одна ячейка - сессия с инструментами на крупном дереве. Перед платной серией кейсов должно быть 10-20, здесь затравка.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SKILL = 'plugins/skills/dex-skill-redis/skills/redis/SKILL.md';

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
      { type: 'file-matches', id: 'trap-added', path: SKILL, regex: 'TTL' },
      { type: 'file-not-matches', id: 'ascii-punctuation', path: SKILL, regex: '[\\u2013\\u2014]' },
      { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] },
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
    const md = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
    const secs = sections(md);
    const conds = [
      { id: 'full', prepare() {} },
      { id: 'empty', prepare(dir) { rmSync(join(dir, 'CLAUDE.md')); } },
      ...secs.map((s, k) => ({
        id: `minus-s${String(k + 1).padStart(2, '0')}`,
        title: s.title,
        prepare(dir) { const L = md.split('\n'); writeFileSync(join(dir, 'CLAUDE.md'), [...L.slice(0, s.start), ...L.slice(s.end)].join('\n')); },
      })),
    ];
    return conds.flatMap((c) => cases.map((k) => ({ cond: c.id, condTitle: c.title, case: k.id, fixture: 'repo', prepare: c.prepare, prompt: k.prompt, graders: k.graders })));
  },
};
