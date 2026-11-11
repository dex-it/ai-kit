export const isoDay = (d) => d.toISOString().slice(0, 10)
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000)
