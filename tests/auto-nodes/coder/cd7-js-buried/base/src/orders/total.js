export function orderTotal(lines) {
  return lines.reduce((s, l) => s + l.price * l.qty, 0)
}
