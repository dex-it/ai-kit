const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const ledgerDown = (e) => Math.trunc(e.status / 100) === 5 || ['ECONNRESET', 'ETIMEDOUT'].includes(e.code)

async function send(ledger, invoice, wait, left = 3, gap = 100) {
  try {
    return await ledger.post(invoice.id, invoice)
  } catch (e) {
    if (left === 1 || !ledgerDown(e)) throw e
    await wait(gap)
    return send(ledger, invoice, wait, left - 1, gap * 2)
  }
}

export async function exportInvoices(invoices, ledger, { wait = pause } = {}) {
  for (const invoice of invoices) await send(ledger, invoice, wait)
  return invoices.length
}
