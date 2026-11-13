export class TimeoutError extends Error {
  constructor(url, ms) {
    super('timeout after ' + ms + ' ms: ' + url)
    this.name = 'TimeoutError'
    this.code = 'ETIMEDOUT'
  }
}

export class HttpError extends Error {
  constructor(url, status, retryAfter) {
    super('http ' + status + ': ' + url)
    this.name = 'HttpError'
    this.status = status
    if (retryAfter != null) this.retryAfter = retryAfter
  }
}
