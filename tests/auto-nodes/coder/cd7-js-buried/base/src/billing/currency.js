export function toMinor(amount) {
  return Math.round(amount * 100)
}

export function format(minor, code = 'RUB') {
  return `${(minor / 100).toFixed(2)} ${code}`
}
