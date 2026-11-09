import test from 'node:test'
import assert from 'node:assert/strict'
import { callWithBackoff } from '../src/platform/net/backoff.js'

test('повтор на 5xx, без повтора на 4xx', async () => {
  let n = 0
  const waits = []
  assert.equal(await callWithBackoff(async () => { if (++n < 3) throw Object.assign(new Error('x'), { status: 503 }); return 'ok' }, { sleep: async (ms) => waits.push(ms) }), 'ok')
  assert.deepEqual(waits, [100, 200])
  await assert.rejects(callWithBackoff(async () => { throw Object.assign(new Error('nf'), { status: 404 }) }, { sleep: async () => {} }), /nf/)
})
