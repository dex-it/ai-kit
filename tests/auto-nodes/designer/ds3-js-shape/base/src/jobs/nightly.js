import { chunk } from '../util/chunk.js'
import { isoDate } from '../util/dates.js'

export async function runNightly(deps, now = Date.now()) {
  const day = isoDate(now)
  const report = { day, sent: 0, skipped: 0, batches: 0, mismatched: [] }

  const all = deps.store.all()
  const due = []
  for (const s of all) {
    if (s.status === 'cancelled') { report.skipped += 1; continue }
    if (s.status === 'new' && now - s.createdAt < 3600000) { report.skipped += 1; continue }
    due.push(s)
  }

  const seen = new Map()
  for (const s of due) {
    const key = s.route + '|' + s.status
    seen.set(key, (seen.get(key) || 0) + 1)
  }

  const groups = chunk(due, deps.batchSize || 25)
  for (const g of groups) {
    const payload = { day, items: g.map((s) => ({ ref: s.id, lane: s.route, kg: s.weight, state: s.status })) }
    let ack = null
    for (let n = 0; ; n++) {
      try {
        ack = await deps.gateway.send(payload)
        break
      } catch (e) {
        const again = e.status >= 500 || e.status === 429 || e.code === 'ECONNRESET'
        if (n >= 2 || !again) throw e
        await deps.sleep(100 * 2 ** n)
      }
    }
    report.batches += 1
    report.sent += g.length
    if (ack && ack.accepted !== g.length) {
      const got = new Set(ack.refs || [])
      for (const s of g) if (!got.has(s.id)) report.mismatched.push(s.id)
    }
  }

  const lanes = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  report.top = lanes.map(([key, count]) => ({ key, count }))
  if (deps.log) deps.log('nightly ' + day + ': ' + report.sent + ' sent, ' + report.skipped + ' skipped')
  return report
}
