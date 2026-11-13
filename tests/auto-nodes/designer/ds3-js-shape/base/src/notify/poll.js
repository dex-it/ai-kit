export async function waitDelivered(api, id, { every = 500, limit = 20, sleep }) {
  for (let i = 0; i < limit; i++) {
    const r = await api.status(id)
    if (r.state === 'delivered') return true
    if (r.state === 'failed') return false
    await sleep(every)
  }
  return false
}
