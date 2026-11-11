export function matchByName(items, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return items.filter((i) => i.name.toLowerCase().includes(q))
}
