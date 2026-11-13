export function splitByWeight(s, limit) {
  if (!(limit > 0)) throw new Error('limit must be positive')
  if (s.weight <= limit) return [s]
  const parts = []
  let rest = s.weight
  let i = 1
  while (rest > 0) {
    const part = Math.min(rest, limit)
    parts.push({ id: s.id + '/' + i, route: s.route, weight: part, status: s.status, createdAt: s.createdAt })
    rest -= part
    i += 1
  }
  return parts
}
