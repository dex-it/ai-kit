export function toRow(x) {
  return { id: x.id, route: x.route, weight: String(x.weight), status: x.status, created_at: x.createdAt }
}

export function fromRow(r) {
  if (!r) return null
  return { id: r.id, route: r.route, weight: Number(r.weight), status: r.status, createdAt: r.created_at }
}
