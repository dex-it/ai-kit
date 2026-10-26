// E3 - кривая дозы: 5/10/20/40 независимых проверяемых обязательств в теле исполнителя.
// Гипотеза: полное соблюдение падает быстрее покомпонентного; порог зависит от тира (R28).
// Обязательство i: поле s<i> = сумма value по записям с тегом t<i>. Данные - в запросе, правила - в дописываемом системном промте.
import { rng } from '../../lib/rng.mjs';

const SIZES = [5, 10, 20, 40];
const SEEDS = [101, 102, 103];

function dataset(seed) {
  const r = rng(seed);
  const records = [];
  for (let i = 1; i <= 80; i++) records.push({ id: `r${String(i).padStart(2, '0')}`, tag: `t${i <= 40 ? i : 1 + Math.floor(r() * 40)}`, value: 1 + Math.floor(r() * 99) });
  return records;
}

export default {
  id: 'E3',
  title: 'Кривая дозы обязательств',
  kind: 'text',
  baseline: 'n05',
  build() {
    const cells = [];
    for (const n of SIZES) for (const seed of SEEDS) {
      const records = dataset(seed);
      const fields = {};
      for (let i = 1; i <= n; i++) fields[`s${i}`] = records.filter((x) => x.tag === `t${i}`).reduce((a, x) => a + x.value, 0);
      const rules = Array.from({ length: n }, (_, i) => `- s${i + 1}: сумма value по всем записям с тегом t${i + 1}`).join('\n');
      cells.push({
        cond: `n${String(n).padStart(2, '0')}`,
        case: `seed${seed}`,
        append: `Ты считаешь агрегаты по записям. Для каждого обязательства ниже вычисли значение и верни все значения в одном JSON-объекте с ключами s1..s${n}, значения - целые числа. Без пояснений.\n\n## Обязательства\n\n${rules}\n`,
        prompt: `Записи (JSON):\n${JSON.stringify(records)}`,
        graders: [{ type: 'json-fields', id: 'agg', fields }],
      });
    }
    return cells;
  },
};
