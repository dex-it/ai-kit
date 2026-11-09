const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const isTransient = (e) => e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || (e.status >= 500 && e.status < 600)

export async function withRetry(fn, { attempts = 3, baseMs = 100, retryOn = isTransient, wait = sleep } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i + 1 >= attempts || !retryOn(e)) throw e
      await wait(baseMs * 2 ** i)
    }
  }
}
