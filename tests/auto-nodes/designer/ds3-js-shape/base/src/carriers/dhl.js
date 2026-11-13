export function fetchWithTimeout(url, ms, fetchImpl = fetch) {
  return Promise.race([
    fetchImpl(url).then((res) => {
      if (!res.ok) throw new Error('bad response ' + res.status)
      return res.json()
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export async function dhlTrack(code, fetchImpl) {
  const r = await fetchWithTimeout('https://api.dhl.example/track/' + code, 2000, fetchImpl)
  return { code, status: r.state, eta: r.estimated }
}
