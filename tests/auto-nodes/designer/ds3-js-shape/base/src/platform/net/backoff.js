const NET = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']

export function isTransient(e) {
  if (!e) return false
  if (NET.includes(e.code)) return true
  return e.status >= 500 || e.status === 429
}

export async function withRetry(fn, { attempts = 3, delays = [100, 200], sleep = defaultSleep } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= attempts - 1 || !isTransient(e)) throw e
      await sleep(delays[Math.min(i, delays.length - 1)])
    }
  }
}

function defaultSleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
