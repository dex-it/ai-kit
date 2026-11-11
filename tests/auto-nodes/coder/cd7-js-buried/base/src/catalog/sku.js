export function normalizeSku(raw) {
  return String(raw).trim().toUpperCase().replace(/\s+/g, '-')
}
