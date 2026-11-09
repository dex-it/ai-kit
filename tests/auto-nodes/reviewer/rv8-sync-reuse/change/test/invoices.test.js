import test from 'node:test'
import assert from 'node:assert/strict'
import { syncInvoices } from '../src/billing/invoices.js'
import { memoryStore } from '../src/util/store.js'

const noWait = async () => {}
const err = (status) => Object.assign(new Error(`http ${status}`), { status })

test('R1, R2: все страницы сохранены', async () => {
  const pages = { null: { data: [{ id: 'I1' }, { id: 'I2' }], cursor: 'c2' }, c2: { data: [{ id: 'I3' }], cursor: null } }
  const store = memoryStore()
  assert.equal(await syncInvoices({ listInvoices: async (c) => pages[c] }, store, { wait: noWait }), 3)
  assert.equal(store.size(), 3)
})

test('R3: 5xx повторяется с паузами 100 и 200 мс', async () => {
  let n = 0
  const waits = []
  const api = { listInvoices: async () => { if (++n < 3) throw err(502); return { data: [{ id: 'I1' }], cursor: null } } }
  assert.equal(await syncInvoices(api, memoryStore(), { wait: async (ms) => waits.push(ms) }), 1)
  assert.deepEqual(waits, [100, 200])
})

test('R3: после трёх попыток ошибка пробрасывается', async () => {
  let n = 0
  await assert.rejects(syncInvoices({ listInvoices: async () => { n++; throw err(500) } }, memoryStore(), { wait: noWait }), /http 500/)
  assert.equal(n, 3)
})

test('R3: сетевая ошибка повторяется', async () => {
  let n = 0
  const api = { listInvoices: async () => { if (++n < 2) throw Object.assign(new Error('reset'), { code: 'ECONNRESET' }); return { data: [], cursor: null } } }
  assert.equal(await syncInvoices(api, memoryStore(), { wait: noWait }), 0)
})

test('R3: 4xx не повторяется', async () => {
  let n = 0
  await assert.rejects(syncInvoices({ listInvoices: async () => { n++; throw err(404) } }, memoryStore(), { wait: noWait }), /http 404/)
  assert.equal(n, 1)
})
