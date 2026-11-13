import { startOfDay, addDays } from '../util/dates.js'

export function lastDays(now, n) {
  const to = startOfDay(now)
  return { from: addDays(to, -n), to }
}
