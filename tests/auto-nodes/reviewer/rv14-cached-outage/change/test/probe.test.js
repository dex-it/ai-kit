import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { probe, resetProbeCache } from '../src/probe.js'

beforeEach(() => resetProbeCache())

const reply = (status, sec) => {
  const calls = []
  const fetchImpl = async (url, init) => (calls.push([url, init.method]), { ok: status < 300, status, headers: { get: () => sec } })
  return { calls, fetchImpl }
}

test('probe - длительность из заголовка (R1)', async () => {
  const { calls, fetchImpl } = reply(200, '12.5')
  assert.deepEqual(await probe('https://v/1', { fetchImpl }), { ok: true, durationSec: 12.5 })
  assert.deepEqual(calls, [['https://v/1', 'HEAD']])
})

test('probe - повтор того же url в пределах 10 минут не ходит к провайдеру (R2)', async () => {
  const { calls, fetchImpl } = reply(200, '12.5')
  let t = 1_000
  const now = () => t
  await probe('https://v/1', { fetchImpl, now })
  t += 9 * 60 * 1000
  await probe('https://v/1', { fetchImpl, now })
  assert.equal(calls.length, 1)
  t += 2 * 60 * 1000
  await probe('https://v/1', { fetchImpl, now })
  assert.equal(calls.length, 2)
})

test('probe - 404, 415 и нет длительности - unsupported (R3)', async () => {
  assert.deepEqual(await probe('https://v/a', { fetchImpl: reply(404).fetchImpl }), { ok: false, reason: 'unsupported' })
  assert.deepEqual(await probe('https://v/b', { fetchImpl: reply(415).fetchImpl }), { ok: false, reason: 'unsupported' })
  assert.deepEqual(await probe('https://v/c', { fetchImpl: reply(200, null).fetchImpl }), { ok: false, reason: 'unsupported' })
})

test('probe - 5xx и сбой сети - unavailable (R3)', async () => {
  assert.deepEqual(await probe('https://v/d', { fetchImpl: reply(503).fetchImpl }), { ok: false, reason: 'unavailable' })
  const down = async () => { throw new Error('ECONNRESET') }
  assert.deepEqual(await probe('https://v/e', { fetchImpl: down }), { ok: false, reason: 'unavailable' })
})
