export function parseBearer(header) {
  const m = /^Bearer\s+(\S+)$/.exec(header || '')
  return m ? m[1] : null
}

export function isExpired(claims, now = Date.now()) {
  return typeof claims.exp === 'number' && claims.exp * 1000 <= now
}
