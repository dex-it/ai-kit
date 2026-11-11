import test from 'node:test'
import assert from 'node:assert/strict'
import { exportInvoices } from '../src/billing/export.js'

const noWait = async () => {}
const err = (status) => Object.assign(new Error(`http ${status}`), { status })

test('R1: счета уходят по порядку', async () => {
  const sent = []
  assert.equal(await exportInvoices([{ id: 'I1' }, { id: 'I2' }], { post: async (id) => sent.push(id) }, { wait: noWait }), 2)
  assert.deepEqual(sent, ['I1', 'I2'])
})

test('R2: 503 дважды - счёт уходит с третьего раза, паузы 100 и 200 мс', async () => {
  let n = 0
  const waits = []
  const ledger = { post: async () => { if (++n < 3) throw err(503) } }
  assert.equal(await exportInvoices([{ id: 'I1' }], ledger, { wait: async (ms) => waits.push(ms) }), 1)
  assert.deepEqual(waits, [100, 200])
})

test('R2: после трёх отправок ошибка пробрасывается', async () => {
  let n = 0
  await assert.rejects(exportInvoices([{ id: 'I1' }], { post: async () => { n++; throw err(500) } }, { wait: noWait }), /http 500/)
  assert.equal(n, 3)
})

test('R2: обрыв соединения - отправка ещё раз', async () => {
  let n = 0
  const ledger = { post: async () => { if (++n < 2) throw Object.assign(new Error('reset'), { code: 'ECONNRESET' }) } }
  assert.equal(await exportInvoices([{ id: 'I1' }], ledger, { wait: noWait }), 1)
  assert.equal(n, 2)
})

test('R2: 4xx пробрасывается сразу', async () => {
  let n = 0
  await assert.rejects(exportInvoices([{ id: 'I1' }], { post: async () => { n++; throw err(409) } }, { wait: noWait }), /http 409/)
  assert.equal(n, 1)
})
