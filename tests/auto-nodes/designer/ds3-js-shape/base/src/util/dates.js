export function startOfDay(ts) {
  const d = new Date(ts)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}
export function addDays(ts, n) { return ts + n * 86400000 }
export function isoDate(ts) { return new Date(ts).toISOString().slice(0, 10) }
