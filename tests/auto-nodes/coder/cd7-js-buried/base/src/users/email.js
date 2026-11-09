export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)
export const normalizeEmail = (s) => s.trim().toLowerCase()
