import test from 'node:test'
import assert from 'node:assert/strict'
import { newShipment } from '../src/shipments/create.js'

test('newShipment заполняет статус и время', () => {
  const s = newShipment({ route: 'MSK-SPB', weight: 12 }, 1000)
  assert.equal(s.status, 'new')
  assert.equal(s.createdAt, 1000)
})

test('newShipment отвергает нулевой вес', () => {
  assert.throws(() => newShipment({ route: 'MSK-SPB', weight: 0 }))
})
