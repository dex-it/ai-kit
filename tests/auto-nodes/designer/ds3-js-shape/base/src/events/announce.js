/** @returns {import('./types.js').ShipmentEvent} */
function created(s) { return { type: 'shipment.created', id: s.id, route: s.route, weight: s.weight } }

export function announceCreated(bus, s) {
  return bus.emit(created(s))
}

export function announceStatus(bus, s) {
  return bus.emit({ type: 'shipment.status', id: s.id, status: s.status })
}
