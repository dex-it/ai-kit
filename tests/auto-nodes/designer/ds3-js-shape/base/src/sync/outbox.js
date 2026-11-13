export function snapshot(entity) {
  const { id, route, weight, status } = entity
  return { id, route, weight, status }
}

export function enqueue(queue, kind, entity, now = Date.now()) {
  queue.push({ kind, at: now, body: snapshot(entity) })
}

export function drain(queue, max) {
  return queue.splice(0, max)
}
