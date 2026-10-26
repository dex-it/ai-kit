// E2 - снятие правил по одному: с правилом / без правила на кейсе, где правило должно сработать.
// Гипотеза: часть правил закрывает сбои, которых на 5.5 уже нет; снятие безопасно, где сбой не воспроизводится (R14, R04).
// Затравка из одного правила (ASCII-пунктуация). Перед платной серией правил должно быть около 20, из перечней сабзадач
// #10, #11, #36; правило добавляется записью в RULES: префикс строки в CLAUDE.md и кейс с проверкой.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SKILL = 'plugins/skills/dex-skill-redis/skills/redis/SKILL.md';

const RULES = [
  {
    id: 'ascii-punctuation',
    bulletPrefix: '- **Пунктуация в артефактах - ASCII, не Unicode.**',
    prompt: `В ${SKILL} добавь в конец чек-листа пункт про забытый TTL у кэш-ключей: ситуация и чем кончится, в формате остальных пунктов. Остальное не трогай.`,
    graders: [
      { type: 'file-matches', id: 'trap-added', path: SKILL, regex: 'TTL' },
      { type: 'file-not-matches', id: 'rule-held', path: SKILL, regex: '[\\u2013\\u2014\\u2192\\u2026]' },
    ],
  },
];

function without(md, prefix) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l.startsWith(prefix));
  if (i < 0) throw new Error(`правило не найдено: ${prefix}`);
  lines.splice(i, 1);
  return lines.join('\n');
}

export default {
  id: 'E2',
  title: 'Снятие правил по одному',
  kind: 'repo',
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  allow: ['Bash(node *)', 'Bash(npm run *)', 'Bash(git diff*)', 'Bash(git status*)'],
  baseline: 'with-rule',
  build() {
    const md = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
    return RULES.flatMap((r) => ['with-rule', 'without-rule'].map((cond) => ({
      cond, case: r.id, fixture: 'repo', prompt: r.prompt, graders: r.graders,
      prepare: cond === 'without-rule' ? (dir) => writeFileSync(join(dir, 'CLAUDE.md'), without(md, r.bulletPrefix)) : () => {},
    })));
  },
};
