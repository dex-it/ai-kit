import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSupplierStock } from '../src/warehouse/replenish.js'
import { memoryStore } from '../src/util/store.js'

test('остатки поставщика собираются со всех страниц', async () => {
  const pages = { null: { items: [{ sku: 'A1' }], next: 't2' }, t2: { items: [{ sku: 'B2' }], next: null } }
  const store = memoryStore()
  assert.equal(await loadSupplierStock({ stock: async ({ after }) => pages[after] }, store), 2)
  assert.ok(store.get('B2'))
})
