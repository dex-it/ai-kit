import { nextId } from '../util/ids.js'

export function newShipment({ route, weight }, now = Date.now()) {
  if (!route) throw new Error('route required')
  if (!(weight > 0)) throw new Error('weight must be positive')
  return { id: nextId('shp'), route, weight, status: 'new', createdAt: now }
}
