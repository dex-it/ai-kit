import { withRetry } from '../lib/retry.js'

export async function pullOrders(shop, store, since) {
  const orders = await withRetry(() => shop.ordersSince(since))
  for (const o of orders) store.put(o.number, { ...o, source: 'shop' })
  return orders.length
}
