import { request } from '../platform/net/request.js'
import { withRetry } from '../platform/net/backoff.js'
import { drain } from './outbox.js'

export async function pushOutbox(queue, { url, fetchImpl, sleep }) {
  const batch = drain(queue, 50)
  if (batch.length === 0) return 0
  await withRetry(() => request(url, { method: 'POST', body: batch, timeoutMs: 5000, fetchImpl }), { sleep })
  return batch.length
}
