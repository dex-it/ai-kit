const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchInvoicePage(api, cursor, wait) {
  let attempt = 0
  while (true) {
    try {
      return await api.listInvoices(cursor)
    } catch (err) {
      attempt++
      const transient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || (err.status >= 500 && err.status < 600)
      if (!transient || attempt >= 3) throw err
      await wait(100 * 2 ** (attempt - 1))
    }
  }
}

export async function syncInvoices(api, store, { wait = delay } = {}) {
  let saved = 0
  let cursor = null
  do {
    const page = await fetchInvoicePage(api, cursor, wait)
    for (const invoice of page.data) {
      store.put(invoice.id, invoice)
      saved++
    }
    cursor = page.cursor
  } while (cursor)
  return saved
}
