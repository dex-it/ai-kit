import { RefRejectedError } from './errors.js'

export async function startGeneration(user, refUrl, deps) {
  const meta = await deps.probe(refUrl)
  if (!meta.ok) throw new RefRejectedError(meta.reason)
  const price = Math.ceil(meta.durationSec) * deps.ratePerSec
  deps.charge(user, price)
  return deps.enqueue(user, refUrl, meta.durationSec)
}
