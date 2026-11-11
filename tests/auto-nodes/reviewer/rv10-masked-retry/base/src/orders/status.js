const FINAL = new Set(['delivered', 'cancelled', 'refunded'])

export const isFinal = (order) => FINAL.has(order.status)

export function nextStatus(order, event) {
  if (isFinal(order)) return order.status
  if (event === 'ship') return 'shipped'
  if (event === 'deliver' && order.status === 'shipped') return 'delivered'
  if (event === 'cancel') return 'cancelled'
  return order.status
}
