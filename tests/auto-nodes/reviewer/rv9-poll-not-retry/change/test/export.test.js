import test from 'node:test'
import assert from 'node:assert/strict'
import { waitForExport } from '../src/reports/export.js'

const states = (...seq) => { let i = 0; return { exportStatus: async () => seq[Math.min(i++, seq.length - 1)] } }

test('R1, R2: опрос до done, паузы по 500 мс, первый опрос сразу', async () => {
  const waits = []
  const url = await waitForExport(states({ state: 'pending' }, { state: 'pending' }, { state: 'done', url: 'u' }), 'J1', { wait: async (ms) => waits.push(ms) })
  assert.equal(url, 'u')
  assert.deepEqual(waits, [500, 500])
})

test('R2: failed - ошибка', async () => {
  await assert.rejects(waitForExport(states({ state: 'failed' }), 'J1', { wait: async () => {} }), /не удалась/)
})

test('R2: 20 опросов в pending - ошибка таймаута', async () => {
  let n = 0
  const api = { exportStatus: async () => { n++; return { state: 'pending' } } }
  await assert.rejects(waitForExport(api, 'J1', { wait: async () => {} }), /не готова за 10 с/)
  assert.equal(n, 20)
})

test('R3: ошибка вызова не повторяется', async () => {
  let n = 0
  const api = { exportStatus: async () => { n++; throw Object.assign(new Error('http 503'), { status: 503 }) } }
  await assert.rejects(waitForExport(api, 'J1', { wait: async () => {} }), /http 503/)
  assert.equal(n, 1)
})
