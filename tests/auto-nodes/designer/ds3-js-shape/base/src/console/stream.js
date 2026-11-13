import { decode } from '../events/wire.js'

const KNOWN = ['shipment.created', 'shipment.status']

export function accept(line) {
  const evt = decode(line)
  if (!evt || !KNOWN.includes(evt.type)) return null
  return evt
}
