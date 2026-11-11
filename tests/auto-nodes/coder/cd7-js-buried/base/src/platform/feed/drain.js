export async function drainFeed(readChunk) {
  const all = []
  let token = null
  do {
    const chunk = await readChunk(token)
    all.push(...chunk.items)
    token = chunk.next
  } while (token)
  return all
}
