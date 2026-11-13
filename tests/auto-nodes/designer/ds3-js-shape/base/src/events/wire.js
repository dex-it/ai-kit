const FIELDS = {
  'shipment.created': ['id', 'route', 'weight'],
  'shipment.status': ['id', 'status'],
}

export function encode(evt) {
  const keep = FIELDS[evt.type]
  if (!keep) return null
  const out = { type: evt.type }
  for (const k of keep) out[k] = evt[k]
  return JSON.stringify(out)
}

export function decode(line) {
  try { return JSON.parse(line) } catch { return null }
}
