let seq = 0
export function nextId(prefix) {
  seq += 1
  return prefix + '-' + String(seq).padStart(6, '0')
}
export function resetIds() { seq = 0 }
