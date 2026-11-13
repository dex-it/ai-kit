export function displayName(u) {
  const full = [u.first, u.last].filter(Boolean).join(' ')
  return full || u.email.split('@')[0]
}
