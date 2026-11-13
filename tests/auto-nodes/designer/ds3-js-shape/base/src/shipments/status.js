import { enqueue } from '../sync/outbox.js'

const NEXT = { new: ['packed', 'cancelled'], packed: ['sent', 'cancelled'], sent: ['delivered'], delivered: [], cancelled: [] }

export function setStatus(store, queue, id, status) {
  const s = store.load(id)
  if (!s) throw new Error('not found: ' + id)
  if (!NEXT[s.status].includes(status)) throw new Error('bad transition ' + s.status + ' -> ' + status)
  s.status = status
  store.save(s)
  enqueue(queue, 'status', s)
  return s
}
