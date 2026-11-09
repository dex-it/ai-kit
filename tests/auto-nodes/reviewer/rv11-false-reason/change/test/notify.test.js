import test from 'node:test'
import assert from 'node:assert/strict'
import { notifySuppliers } from '../src/suppliers/notify.js'

const noWait = async () => {}
const err = (status) => Object.assign(new Error(`http ${status}`), { status })
const order = { number: 'N-7' }

test('R1: письмо каждому поставщику', async () => {
  const sent = []
  const mailer = { send: async (to, body) => sent.push([to, body.order]) }
  assert.equal(await notifySuppliers([{ email: 'a@x.ru' }, { email: 'b@x.ru' }], mailer, order, { wait: noWait }), 2)
  assert.deepEqual(sent, [['a@x.ru', 'N-7'], ['b@x.ru', 'N-7']])
})

test('R2: 502 дважды - письмо уходит с третьего раза, паузы 100 и 200 мс', async () => {
  let n = 0
  const waits = []
  const mailer = { send: async () => { if (++n < 3) throw err(502) } }
  assert.equal(await notifySuppliers([{ email: 'a@x.ru' }], mailer, order, { wait: async (ms) => waits.push(ms) }), 1)
  assert.deepEqual(waits, [100, 200])
})

test('R2: после трёх отправок ошибка пробрасывается', async () => {
  let n = 0
  await assert.rejects(notifySuppliers([{ email: 'a@x.ru' }], { send: async () => { n++; throw err(500) } }, order, { wait: noWait }), /http 500/)
  assert.equal(n, 3)
})

test('R2: таймаут соединения - отправка ещё раз', async () => {
  let n = 0
  const mailer = { send: async () => { if (++n < 2) throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) } }
  assert.equal(await notifySuppliers([{ email: 'a@x.ru' }], mailer, order, { wait: noWait }), 1)
  assert.equal(n, 2)
})

test('R2: 4xx пробрасывается сразу', async () => {
  let n = 0
  await assert.rejects(notifySuppliers([{ email: 'a@x.ru' }], { send: async () => { n++; throw err(422) } }, order, { wait: noWait }), /http 422/)
  assert.equal(n, 1)
})
