import { callWithBackoff } from '../platform/net/backoff.js'
import { drainFeed } from '../platform/feed/drain.js'

export async function loadSupplierStock(supplier, store) {
  const rows = await drainFeed((next) => callWithBackoff(() => supplier.stock({ after: next })))
  for (const r of rows) store.put(r.sku, r)
  return rows.length
}
