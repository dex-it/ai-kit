const tick = (ms) => new Promise((r) => setTimeout(r, ms))

export async function waitDelivered(gateway, id, { every = 500, limit = 20 } = {}) {
  for (let i = 0; i < limit; i++) {
    const s = await gateway.status(id)
    if (s === 'delivered' || s === 'failed') return s
    await tick(every)
  }
  return 'unknown'
}
