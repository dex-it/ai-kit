const LINES = {
  'shipment.created': (e) => 'Создано: ' + e.id + ' (' + e.route + ')',
  'shipment.status': (e) => 'Статус: ' + e.id + ' -> ' + e.status,
}

/** @param {import('./types.js').ShipmentEvent[]} events */
export function renderFeed(events) {
  return events.map((e) => LINES[e.type](e))
}
