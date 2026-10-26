// E7 - выбор skill при росте библиотеки: 10/30/100 skills в листинге.
// Гипотеза: различимые описания держат точность, но ошибки выбора растут с размером библиотеки (R21, R22).
// Это однократный выбор по листингу (прокси), а не активация через Skill tool в живой сессии: живую активацию меряет tools/run-activation.js.
// Библиотека - реальные skills каталога на коммите прогона, кейсы - tests/activation/cases.json.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { rng, shuffle } from '../../lib/rng.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SIZES = [10, 30, 100];

function catalog() {
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
  build({ cases: limit } = {}) {
    const lib = catalog();
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
