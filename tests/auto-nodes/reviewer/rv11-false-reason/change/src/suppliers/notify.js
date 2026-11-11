const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Свой повтор: withRetry из lib не даёт задать, какие ошибки повторять, а шлюзу нужен свой набор кодов.
const gatewayDown = (e) => e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || (e.status >= 500 && e.status < 600)

async function sendWithRetry(mailer, to, body, wait) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await mailer.send(to, body)
    } catch (e) {
      if (attempt >= 3 || !gatewayDown(e)) throw e
      await wait(100 * 2 ** (attempt - 1))
    }
  }
}

export async function notifySuppliers(suppliers, mailer, order, { wait = sleep } = {}) {
  for (const s of suppliers) await sendWithRetry(mailer, s.email, { order: order.number }, wait)
  return suppliers.length
}
