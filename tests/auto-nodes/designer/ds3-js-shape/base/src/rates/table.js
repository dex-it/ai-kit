import { request } from '../platform/net/request.js'
import { withRetry } from '../platform/net/backoff.js'

let cached = null

export async function loadRates(fetchImpl, sleep) {
  if (cached) return cached
  cached = await withRetry(() => request('https://rates.example/table', { timeoutMs: 3000, fetchImpl }), { sleep })
  return cached
}

export function rateFor(table, zone, weight) {
  const row = table.find((r) => r.zone === zone && weight <= r.upTo)
  if (!row) throw new Error('no rate for zone ' + zone)
  return row.price
}

export function dropRates() { cached = null }
