export function volumeByRoute(items) {
  const out = {}
  for (const it of items) out[it.route] = (out[it.route] || 0) + it.weight
  return out
}
