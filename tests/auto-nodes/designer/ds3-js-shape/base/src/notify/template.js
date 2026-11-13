const T = {
  packed: 'Ваш заказ {id} собран',
  sent: 'Ваш заказ {id} в пути',
  delivered: 'Ваш заказ {id} доставлен',
}

export function render(status, vars) {
  const t = T[status]
  if (!t) return null
  return t.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ''))
}
