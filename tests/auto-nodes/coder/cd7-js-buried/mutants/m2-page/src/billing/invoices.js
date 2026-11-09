import { callWithBackoff } from '../platform/net/backoff.js'
import { drainFeed } from '../platform/feed/drain.js'

export async function syncInvoices(api, store, retry = {}) {
  const invoices = await drainFeed(async (next) => {
    const page = await callWithBackoff(() => api.listInvoices(next), retry)
    return { items: page.data, next: null }
  })
  for (const invoice of invoices) store.put(invoice.id, invoice)
  return invoices.length
}
