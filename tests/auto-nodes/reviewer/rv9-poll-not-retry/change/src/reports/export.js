const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const POLL_MS = 500
const MAX_POLLS = 20

export async function waitForExport(api, jobId, { wait = delay } = {}) {
  for (let poll = 1; poll <= MAX_POLLS; poll++) {
    const { state, url } = await api.exportStatus(jobId)
    if (state === 'done') return url
    if (state === 'failed') throw new Error('выгрузка не удалась')
    if (poll < MAX_POLLS) await wait(POLL_MS)
  }
  throw new Error('выгрузка не готова за 10 с')
}
