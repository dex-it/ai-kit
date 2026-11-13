import { TimeoutError, HttpError } from './errors.js'

export async function request(url, { method = 'GET', body, timeoutMs = 10000, fetchImpl = fetch } = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method,
      signal: ctl.signal,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const ra = res.headers && res.headers.get ? res.headers.get('retry-after') : null
      throw new HttpError(url, res.status, ra == null ? undefined : Number(ra))
    }
    return await res.json()
  } catch (e) {
    if (e && e.name === 'AbortError') throw new TimeoutError(url, timeoutMs)
    throw e
  } finally {
    clearTimeout(timer)
  }
}
