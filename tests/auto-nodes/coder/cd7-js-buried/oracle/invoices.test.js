import test from 'node:test'
import assert from 'node:assert/strict'
import { syncInvoices } from '../src/billing/invoices.js'
import { memoryStore } from '../src/util/store.js'
import { loadSupplierStock } from '../src/warehouse/replenish.js'

const err = (props) => Object.assign(new Error('fail'), props)
const pagesApi = () => {
  const calls = []
  const pages = { null: { data: [{ id: 'i1' }, { id: 'i2' }], cursor: 'c2' }, c2: { data: [{ id: 'i3' }], cursor: null } }
  return { calls, listInvoices: async (c) => { calls.push(c); return pages[c] } }
}
const flaky = (failures, page = { data: [{ id: 'x' }], cursor: null }) => {
  let n = 0
  return { calls: () => n, listInvoices: async () => { n++; if (failures.length) throw failures.shift(); return page } }
}

test('R1 все счета в store, число сохранённых', async () => {
  const store = memoryStore()
  assert.equal(await syncInvoices(pagesApi(), store), 3)
  assert.deepEqual(store.get('i3'), { id: 'i3' })
  assert.equal(store.size(), 3)
})
test('R2 первый вызов с null, далее по cursor', async () => {
  const api = pagesApi()
  await syncInvoices(api, memoryStore())
  assert.deepEqual(api.calls, [null, 'c2'])
})
test('R3 5xx повторяется, третья попытка успешна', async () => {
  const api = flaky([err({ status: 503 }), err({ status: 500 })])
  const t0 = Date.now()
  assert.equal(await syncInvoices(api, memoryStore()), 1)
  assert.equal(api.calls(), 3)
  assert.ok(Date.now() - t0 >= 280)
})
test('R3 сетевая ошибка повторяется', async () => {
  const api = flaky([err({ code: 'ECONNRESET' })])
  assert.equal(await syncInvoices(api, memoryStore()), 1)
  assert.equal(api.calls(), 2)
})
test('R3 после трёх попыток ошибка пробрасывается', async () => {
  const api = flaky([err({ status: 502 }), err({ status: 502 }), err({ status: 502 }), err({ status: 502 })])
  await assert.rejects(syncInvoices(api, memoryStore()), (e) => e.status === 502)
  assert.equal(api.calls(), 3)
})
test('R3 4xx не повторяется', async () => {
  const api = flaky([err({ status: 404 })])
  await assert.rejects(syncInvoices(api, memoryStore()), (e) => e.status === 404)
  assert.equal(api.calls(), 1)
})
test('regression supplier stock', async () => {
  const pages = { null: { items: [{ sku: 'A1' }], next: null } }
  assert.equal(await loadSupplierStock({ stock: async ({ after }) => pages[after] }, memoryStore()), 1)
})
