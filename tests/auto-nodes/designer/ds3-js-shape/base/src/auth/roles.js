const GRANTS = { operator: ['read', 'status'], manager: ['read', 'status', 'create', 'cancel'], auditor: ['read'] }

export function can(role, action) {
  return (GRANTS[role] || []).includes(action)
}
