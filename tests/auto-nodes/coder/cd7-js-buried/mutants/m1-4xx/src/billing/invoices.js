import { callWithBackoff } from '../platform/net/backoff.js'
import { drainFeed } from '../platform/feed/drain.js'

export async function syncInvoices(api, store, retry = {}) {
  const invoices = await drainFeed(async (next) => {
    const page = await callWithBackoff(() => api.listInvoices(next), { ...retry, shouldRetry: () => true })
    return { items: page.data, next: page.cursor }
  })
  for (const invoice of invoices) store.put(invoice.id, invoice)
  return invoices.length
}
