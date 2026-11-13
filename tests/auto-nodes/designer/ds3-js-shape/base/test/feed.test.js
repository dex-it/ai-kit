import test from 'node:test'
import assert from 'node:assert/strict'
import { renderFeed } from '../src/console/feed.js'

test('renderFeed печатает строку на событие', () => {
  assert.deepEqual(renderFeed([{ type: 'shipment.status', id: 'shp-1', status: 'sent' }]), ['Статус: shp-1 -> sent'])
})
