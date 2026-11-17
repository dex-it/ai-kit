import { CartLimitError } from './errors.js'

export const MAX_KG = 30

export function newCart() {
  return { items: [] }
}

export function totalKg(cart) {
  return cart.items.reduce((sum, i) => sum + i.kg * i.qty, 0)
}

export function addItem(cart, item) {
  if (!(item.kg > 0)) throw new RangeError(`kg ${item.kg} <= 0`)
  if (totalKg(cart) + item.kg * item.qty > MAX_KG) throw new CartLimitError(`cart over ${MAX_KG} kg`)
  cart.items.push(item)
  return cart
}
