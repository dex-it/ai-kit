// E3 - кривая дозы: 5/10/20/40/80/160 независимых проверяемых обязательств в теле исполнителя.
// Гипотеза: полное соблюдение падает быстрее покомпонентного; порог зависит от тира (R28).
// Обязательство i: поле s<i> - агрегат по записям с тегом t<i>; вид агрегата чередуется (восемь видов: сумма, число, максимум, сумма чётных, число больших, размах,
// номер записи с максимумом, сумма двух наибольших), чтобы обязательства различались по правилу, а не повторяли одно. Данные - в запросе, правила - в дописываемом системном промте.
// Пилот 2 показал потолок: Haiku держал 1,00 на 40 одинаковых суммах, на 160 агрегатах трёх видов спад был только на 160. Постановка v2: на тег приходится в среднем
// 5 записей (было 2), записи перемешаны (теги не идут подряд), два новых вида требуют выбора записи, а не сложения; размеры те же (5-160).
import { rng, shuffle } from '../../lib/rng.mjs';

const SIZES = [5, 10, 20, 40, 80, 160];
const SEEDS = 3; // по умолчанию 3 seed; --cases N даёт N seed (101..100+N)
const KINDS = [
  { name: 'сумма value по всем записям с тегом', f: (xs) => xs.reduce((a, x) => a + x.value, 0) },
  { name: 'число записей с тегом', f: (xs) => xs.length },
  { name: 'максимум value среди записей с тегом', f: (xs) => Math.max(...xs.map((x) => x.value)) },
  { name: 'сумма value только чётных записей (value чётное) с тегом', f: (xs) => xs.filter((x) => x.value % 2 === 0).reduce((a, x) => a + x.value, 0) },
  { name: 'число записей с value больше 50 среди записей с тегом', f: (xs) => xs.filter((x) => x.value > 50).length },
  { name: 'разность максимума и минимума value среди записей с тегом', f: (xs) => Math.max(...xs.map((x) => x.value)) - Math.min(...xs.map((x) => x.value)) },
  { name: 'числовой номер записи (r017 -> 17) с наибольшим value среди записей с тегом; при равенстве - с меньшим номером', f: (xs) => Math.min(...xs.filter((x) => x.value === Math.max(...xs.map((y) => y.value))).map((x) => Number(x.id.slice(1)))) },
  { name: 'сумма двух наибольших value среди записей с тегом (если запись одна - её value)', f: (xs) => xs.map((x) => x.value).sort((a, b) => b - a).slice(0, 2).reduce((a, x) => a + x, 0) },
];
const PER_TAG = 12;

function dataset(seed, tags) { // каждый тег встречается минимум один раз; всего PER_TAG записей на тег в среднем; порядок записей перемешан
  const r = rng(seed);
  const records = [];
  for (let i = 1; i <= PER_TAG * tags; i++) records.push({ id: `r${String(i).padStart(3, '0')}`, tag: `t${i <= tags ? i : 1 + Math.floor(r() * tags)}`, value: 1 + Math.floor(r() * 99) });
  return shuffle(records, r);
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
