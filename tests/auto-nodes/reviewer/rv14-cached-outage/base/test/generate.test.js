import test from 'node:test'
import assert from 'node:assert/strict'
import { startGeneration } from '../src/generate.js'
import { RefRejectedError } from '../src/errors.js'

const deps = (probe) => {
  const log = []
  return { log, probe, ratePerSec: 2, charge: (u, p) => log.push(['charge', p]), enqueue: (u, url, s) => (log.push(['enqueue', s]), 'job-1') }
}

test('генерация - списание по длительности', async () => {
  const d = deps(async () => ({ ok: true, durationSec: 4.2 }))
  assert.equal(await startGeneration('u1', 'https://v/1', d), 'job-1')
  assert.deepEqual(d.log, [['charge', 10], ['enqueue', 4.2]])
})

test('генерация - отказ пробы без списания', async () => {
  const d = deps(async () => ({ ok: false, reason: 'unsupported' }))
  await assert.rejects(startGeneration('u1', 'https://v/1', d), RefRejectedError)
  assert.deepEqual(d.log, [])
})
