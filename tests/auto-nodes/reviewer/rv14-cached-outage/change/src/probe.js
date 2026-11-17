const TTL_MS = 10 * 60 * 1000
const cache = new Map()

export function resetProbeCache() {
  cache.clear()
}

export async function probe(url, { fetchImpl = fetch, now = Date.now } = {}) {
  const hit = cache.get(url)
  if (hit && now() - hit.at < TTL_MS) return hit.result
  const result = await request(url, fetchImpl)
  cache.set(url, { at: now(), result })
  return result
}

async function request(url, fetchImpl) {
  let res
  try {
    res = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (res.status === 404 || res.status === 415) return { ok: false, reason: 'unsupported' }
  if (!res.ok) return { ok: false, reason: 'unavailable' }
  const sec = Number(res.headers.get('x-duration-sec'))
  if (!(sec > 0)) return { ok: false, reason: 'unsupported' }
  return { ok: true, durationSec: sec }
}
