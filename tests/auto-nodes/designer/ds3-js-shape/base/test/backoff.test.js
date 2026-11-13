import test from 'node:test'
import assert from 'node:assert/strict'
import { withRetry } from '../src/platform/net/backoff.js'

test('withRetry повторяет 5xx и возвращает результат', async () => {
  let n = 0
  const slept = []
  const r = await withRetry(async () => { n += 1; if (n < 3) throw { status: 503 }; return 'ok' }, { sleep: async (ms) => { slept.push(ms) } })
  assert.equal(r, 'ok')
  assert.deepEqual(slept, [100, 200])
})

test('withRetry не повторяет 4xx', async () => {
  let n = 0
  await assert.rejects(withRetry(async () => { n += 1; throw { status: 404 } }, { sleep: async () => {} }))
  assert.equal(n, 1)
})
