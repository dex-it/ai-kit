export const isoDay = (d) => d.toISOString().slice(0, 10)

export function daysBetween(a, b) {
  return Math.round((b - a) / 86_400_000)
}
