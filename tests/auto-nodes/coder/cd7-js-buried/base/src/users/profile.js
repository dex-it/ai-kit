export function displayName(u) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
}
