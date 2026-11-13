export function parseBearer(header) {
  if (typeof header !== 'string') return null
  const m = /^Bearer\s+(\S+)$/.exec(header)
  return m ? m[1] : null
}
