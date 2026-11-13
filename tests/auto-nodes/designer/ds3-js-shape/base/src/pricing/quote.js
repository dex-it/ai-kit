import { toMinor } from '../util/money.js'
import { rateFor } from '../rates/table.js'

export function quote(table, zone, weight, surcharge = 0) {
  return toMinor(rateFor(table, zone, weight) * weight) + toMinor(surcharge)
}
