// E3 - кривая дозы: 5/10/20/40/80/160 независимых проверяемых обязательств в теле исполнителя.
// Гипотеза: полное соблюдение падает быстрее покомпонентного; порог зависит от тира (R28).
// Обязательство i: поле s<i> - агрегат по записям с тегом t<i>; вид агрегата чередуется (шесть видов: сумма, число, максимум, сумма чётных, число больших, размах),
// чтобы обязательства различались по правилу, а не повторяли одно. Данные - в запросе, правила - в дописываемом системном промте.
// Пилот показал потолок: Haiku держит 1,00 на 40 одинаковых суммах и на 160 агрегатах трёх видов, поэтому виды усложнены и размеры расширены до 160.
import { rng } from '../../lib/rng.mjs';

const SIZES = [5, 10, 20, 40, 80, 160];
const SEEDS = 3; // по умолчанию 3 seed; --cases N даёт N seed (101..100+N)
const KINDS = [
  { name: 'сумма value по всем записям с тегом', f: (xs) => xs.reduce((a, x) => a + x.value, 0) },
  { name: 'число записей с тегом', f: (xs) => xs.length },
  { name: 'максимум value среди записей с тегом', f: (xs) => Math.max(...xs.map((x) => x.value)) },
  { name: 'сумма value только чётных записей (value чётное) с тегом', f: (xs) => xs.filter((x) => x.value % 2 === 0).reduce((a, x) => a + x.value, 0) },
  { name: 'число записей с value больше 50 среди записей с тегом', f: (xs) => xs.filter((x) => x.value > 50).length },
  { name: 'разность максимума и минимума value среди записей с тегом', f: (xs) => Math.max(...xs.map((x) => x.value)) - Math.min(...xs.map((x) => x.value)) },
];

function dataset(seed, tags) { // каждый тег встречается минимум один раз; всего 2 записи на тег
  const r = rng(seed);
  const records = [];
  for (let i = 1; i <= 2 * tags; i++) records.push({ id: `r${String(i).padStart(3, '0')}`, tag: `t${i <= tags ? i : 1 + Math.floor(r() * tags)}`, value: 1 + Math.floor(r() * 99) });
  return records;
}

export default {
  id: 'E3',
  title: 'Кривая дозы обязательств',
  kind: 'text',
  baseline: 'n005',
  build({ cases } = {}) {
    const cells = [];
    const seeds = Array.from({ length: cases ?? SEEDS }, (_, i) => 101 + i);
    for (const n of SIZES) for (const seed of seeds) {
      const records = dataset(seed, n);
      const fields = {};
      for (let i = 1; i <= n; i++) fields[`s${i}`] = KINDS[i % KINDS.length].f(records.filter((x) => x.tag === `t${i}`));
      const rules = Array.from({ length: n }, (_, i) => `- s${i + 1}: ${KINDS[(i + 1) % KINDS.length].name} t${i + 1}`).join('\n');
      cells.push({
        cond: `n${String(n).padStart(3, '0')}`,
        case: `seed${seed}`,
        append: `Ты считаешь агрегаты по записям. Для каждого обязательства ниже вычисли значение и верни все значения в одном JSON-объекте с ключами s1..s${n}, значения - целые числа. Без пояснений.\n\n## Обязательства\n\n${rules}\n`,
        prompt: `Записи (JSON):\n${JSON.stringify(records)}`,
        graders: [{ type: 'json-fields', id: 'agg', fields }],
      });
    }
    return cells;
  },
};
