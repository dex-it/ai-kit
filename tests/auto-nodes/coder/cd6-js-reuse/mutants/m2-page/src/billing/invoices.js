import { withRetry } from '../lib/retry.js'
import { collectPages } from '../lib/pages.js'

export async function syncInvoices(api, store, retry = {}) {
  const invoices = await collectPages(async (next) => {
    const page = await withRetry(() => api.listInvoices(next), retry)
    return { items: page.data, next: null }
  })
  for (const invoice of invoices) store.put(invoice.id, invoice)
  return invoices.length
}
