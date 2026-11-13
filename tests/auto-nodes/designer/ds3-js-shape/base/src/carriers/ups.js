import { fetchWithTimeout } from './dhl.js'

export async function upsTrack(code, fetchImpl) {
  const r = await fetchWithTimeout('https://api.ups.example/v2/track?n=' + code, 2000, fetchImpl)
  return { code, status: r.status.toLowerCase(), eta: r.delivery ? r.delivery.date : null }
}
