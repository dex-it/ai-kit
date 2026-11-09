export function memoryStore() {
  const m = new Map()
  return { put: (k, v) => m.set(k, v), get: (k) => m.get(k), size: () => m.size }
}
