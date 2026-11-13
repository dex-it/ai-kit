import { startOfDay } from '../util/dates.js'

export function compact(items, before) {
  const edge = startOfDay(before)
  return items
    .filter((it) => it.createdAt < edge && (it.status === 'delivered' || it.status === 'cancelled'))
    .map((it) => ({ id: it.id, route: it.route, status: it.status }))
}
