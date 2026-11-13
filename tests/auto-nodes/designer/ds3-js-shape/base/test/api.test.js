import test from 'node:test'
import assert from 'node:assert/strict'
import { toResponse } from '../src/api/shipments.js'

test('toResponse не отдаёт время создания', () => {
  const r = toResponse({ id: 'shp-1', route: 'MSK-SPB', weight: 3, status: 'new', createdAt: 5 })
  assert.deepEqual(r, { id: 'shp-1', route: 'MSK-SPB', weight: 3, status: 'new' })
})
