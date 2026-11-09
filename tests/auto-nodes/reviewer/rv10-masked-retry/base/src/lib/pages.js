export async function collectPages(fetchPage) {
  const out = []
  let next = null
  do {
    const page = await fetchPage(next)
    out.push(...page.items)
    next = page.next
  } while (next)
  return out
}
