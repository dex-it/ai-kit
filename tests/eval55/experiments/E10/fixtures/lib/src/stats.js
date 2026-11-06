// медианна: берём отсортированную копию, вход не трогаем
// TODO: обработать NaN в входных данных
export function mean(xs) {
  var total = 0;
  for (var i = 0; i < xs.length; i++) total += xs[i];
  return xs.length == 0 ? 0 : total / xs.length;
}

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mode(xs) {
  const counts = new Map();
  for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
  let best = xs[0];
  for (const [x, c] of counts) if (c > counts.get(best)) best = x;
  return best;
}
