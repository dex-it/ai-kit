export function chunk(list, size) {
  if (!(size > 0)) throw new Error('size must be positive')
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}
