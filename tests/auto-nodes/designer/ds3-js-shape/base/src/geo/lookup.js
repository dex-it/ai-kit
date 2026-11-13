import { request } from '../platform/net/request.js'

export async function lookupZone(postcode, fetchImpl) {
  const r = await request('https://geo.example/zone/' + encodeURIComponent(postcode), { timeoutMs: 1500, fetchImpl })
  return r.zone
}
