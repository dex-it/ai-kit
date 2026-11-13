export function pickSlot(slots, weight) {
  const free = slots.filter((s) => !s.busy && s.capacity >= weight)
  free.sort((a, b) => a.capacity - b.capacity)
  return free[0] || null
}
