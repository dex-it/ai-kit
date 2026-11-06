// Агрегация результатов eval55: ячейка -> среднее по условию и тиру, парные разности условий, полоса шума.
// Решающее правило (PREREG.md): правка принимается, если разность условий выходит за max(полоса шума, 2 SE) в нужную сторону.

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
export const se = (xs) => (xs.length ? sd(xs) / Math.sqrt(xs.length) : NaN);

export function cellScore(checks) {
  const n = checks.length;
  const ok = checks.filter((c) => c.pass).length;
  return { score: n ? ok / n : 0, full: n > 0 && ok === n };
}

const key = (r) => `${r.exp}|${r.tier}|${r.cond}`;

export function summarize(rows) {
  const g = new Map();
  for (const r of rows) (g.get(key(r)) || g.set(key(r), []).get(key(r))).push(r);
  return [...g.entries()].map(([k, rs]) => {
    const [exp, tier, cond] = k.split('|');
    const scores = rs.map((r) => r.score);
    return {
      exp, tier, cond, n: rs.length, errors: rs.filter((r) => r.error).length,
      score: mean(scores), scoreSe: se(scores), full: mean(rs.map((r) => (r.full ? 1 : 0))),
      cost: mean(rs.map((r) => r.cost ?? 0)), costSum: rs.reduce((a, r) => a + (r.cost ?? 0), 0), turns: mean(rs.map((r) => r.turns ?? 0)),
    };
  }).sort((a, b) => a.exp.localeCompare(b.exp) || a.tier.localeCompare(b.tier) || a.cond.localeCompare(b.cond));
}

/** Парная разность условия cond с базой base: пары по (case, rep) внутри тира. */
export function paired(rows, base) {
  const out = [];
  const byTier = new Map();
  for (const r of rows) (byTier.get(`${r.exp}|${r.tier}`) || byTier.set(`${r.exp}|${r.tier}`, []).get(`${r.exp}|${r.tier}`)).push(r);
  for (const [k, rs] of byTier) {
    const [exp, tier] = k.split('|');
    const baseMap = new Map(rs.filter((r) => r.cond === base).map((r) => [`${r.case}|${r.rep}`, r]));
    for (const cond of [...new Set(rs.map((r) => r.cond))].filter((c) => c !== base)) {
      const diffs = rs.filter((r) => r.cond === cond && baseMap.has(`${r.case}|${r.rep}`)).map((r) => r.score - baseMap.get(`${r.case}|${r.rep}`).score);
      out.push({ exp, tier, cond, base, pairs: diffs.length, delta: mean(diffs), se: se(diffs) });
    }
  }
  return out;
}

/** Полоса шума: два независимых прогона одной и той же базы; на ячейку (exp, tier, cond) - max(|A - B|, 2 SE разности средних).
 *  SE разности средних = sqrt(SE_A^2 + SE_B^2) по ячейкам (кейс x повтор) каждой серии; он включает разброс между кейсами, поэтому полоса консервативна. */
export function noise(rowsA, rowsB) {
  const a = new Map(summarize(rowsA).map((s) => [`${s.exp}|${s.tier}|${s.cond}`, s]));
  const out = [];
  for (const s of summarize(rowsB)) {
    const x = a.get(`${s.exp}|${s.tier}|${s.cond}`);
    if (!x) continue;
    const diff = Math.abs(x.score - s.score);
    const se2 = 2 * Math.hypot(x.scoreSe || 0, s.scoreSe || 0);
    out.push({ exp: s.exp, tier: s.tier, cond: s.cond, nA: x.n, nB: s.n, a: x.score, b: s.score, diff, se2, band: Math.max(diff, se2) });
  }
  return out;
}
