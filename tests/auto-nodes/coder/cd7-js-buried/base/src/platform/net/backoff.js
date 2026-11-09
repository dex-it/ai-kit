const pause = (ms) => new Promise((r) => setTimeout(r, ms))

export const isRetryable = (e) => e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || (e.status >= 500 && e.status < 600)

export async function callWithBackoff(op, { tries = 3, firstDelayMs = 100, shouldRetry = isRetryable, sleep = pause } = {}) {
  for (let n = 1; ; n++) {
    try {
      return await op()
    } catch (e) {
      if (n >= tries || !shouldRetry(e)) throw e
      await sleep(firstDelayMs * 2 ** (n - 1))
    }
  }
}
