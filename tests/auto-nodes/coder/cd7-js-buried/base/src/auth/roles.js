const RANK = { viewer: 0, editor: 1, admin: 2 }

export const canEdit = (user) => (RANK[user.role] ?? -1) >= RANK.editor
export const canAdmin = (user) => user.role === 'admin'
