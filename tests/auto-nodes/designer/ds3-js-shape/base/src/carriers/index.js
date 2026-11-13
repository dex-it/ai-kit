import { dhlTrack } from './dhl.js'
import { upsTrack } from './ups.js'

const BY_PREFIX = { JD: dhlTrack, '1Z': upsTrack }

export function trackerFor(code) {
  const hit = Object.keys(BY_PREFIX).find((p) => code.startsWith(p))
  if (!hit) throw new Error('unknown carrier for ' + code)
  return BY_PREFIX[hit]
}
