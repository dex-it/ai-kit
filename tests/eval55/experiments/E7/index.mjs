// E7 - выбор skill при росте библиотеки: 10/30/100 skills в листинге.
// Гипотеза: различимые описания держат точность, но ошибки выбора растут с размером библиотеки (R21, R22).
// Это однократный выбор по листингу (прокси), а не активация через Skill tool в живой сессии: живую активацию меряет tools/run-activation.js.
// Библиотека - реальные skills каталога на коммите прогона, кейсы - tests/activation/cases.json на нём же.
// Отложен (решение владельца): пилот не различил размеры, нужна постановка с жёсткими соседями в листинге (#35); набор не усложнялся и не гонялся.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import matter from 'gray-matter';
import { rng, shuffle } from '../../lib/rng.mjs';
import { exportAt } from '../../lib/repo.mjs';

const SIZES = [10, 30, 100];

function catalog(root) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e.startsWith('.')) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e === 'SKILL.md') {
        let plugin = dirname(dirname(dirname(p)));
        while (plugin !== root && !existsSync(join(plugin, '.claude-plugin', 'plugin.json'))) plugin = dirname(plugin);
        const d2 = matter(readFileSync(p, 'utf8')).data;
        out.push({ id: `${basename(plugin)}:${basename(dirname(p))}`, description: String(d2.description ?? '').replace(/\s+/g, ' ').trim() });
      }
    }
  };
  walk(join(root, 'plugins'));
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export default {
  id: 'E7',
  title: 'Выбор skill при росте библиотеки',
  kind: 'text',
  baseline: 'lib010',
  build({ cases: limit, commit = 'HEAD' } = {}) {
    // Библиотека и кейсы - с коммита прогона, а не из рабочего дерева.
    const root = exportAt(commit, ['plugins/*SKILL.md', 'plugins/*/.claude-plugin/plugin.json', 'tests/activation/cases.json']);
    const lib = catalog(root);
    const ids = new Set(lib.map((s) => s.id));
    const all = JSON.parse(readFileSync(join(root, 'tests/activation/cases.json'), 'utf8')).filter((c) => ids.has(c.expect));
    const picked = shuffle(all, rng(7)).slice(0, limit ?? 20);
    const cells = [];
    for (const size of SIZES) for (const c of picked) {
      const r = rng(1000 + size + c.id.length);
      const others = shuffle(lib.filter((s) => s.id !== c.expect), r).slice(0, size - 1);
      const listing = shuffle([lib.find((s) => s.id === c.expect), ...others], r).map((s) => `- ${s.id}: ${s.description}`).join('\n');
      cells.push({
        cond: `lib${String(size).padStart(3, '0')}`,
        case: c.id,
        prompt: `Доступные skills:\n${listing}\n\nЗапрос пользователя:\n${c.prompt}\n\nКакой один skill нужно вызвать? Ответь только его именем в форме плагин:skill. Если ни один не подходит, ответь none.`,
        graders: [c.mode === 'near-miss' ? { type: 'output-not-equals', id: 'not-hijacked', value: c.expect } : { type: 'output-equals', id: 'picked', value: c.expect }],
      });
    }
    return cells;
  },
};
