import { newShipment } from '../shipments/create.js'

export function toResponse(s) {
  return { id: s.id, route: s.route, weight: s.weight, status: s.status }
}

export function postShipment(store, body) {
  const s = newShipment({ route: body.route, weight: body.weight })
  store.save(s)
  return { status: 201, body: toResponse(s) }
}

export function getShipment(store, id) {
  const s = store.load(id)
  if (!s) return { status: 404, body: { error: 'not found' } }
  return { status: 200, body: toResponse(s) }
}
