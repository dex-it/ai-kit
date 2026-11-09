import test from 'node:test'
import assert from 'node:assert/strict'
import { withRetry } from '../src/lib/retry.js'

test('повтор на 5xx, без повтора на 4xx', async () => {
  let n = 0
  const waits = []
  assert.equal(await withRetry(async () => { if (++n < 3) throw Object.assign(new Error('x'), { status: 503 }); return 'ok' }, { wait: async (ms) => waits.push(ms) }), 'ok')
  assert.deepEqual(waits, [100, 200])
  await assert.rejects(withRetry(async () => { throw Object.assign(new Error('nf'), { status: 404 }) }, { wait: async () => {} }), /nf/)
})
