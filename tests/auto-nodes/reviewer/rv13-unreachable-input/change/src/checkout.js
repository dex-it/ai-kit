import { totalKg } from './cart.js'
import { shippingCost } from './shipping.js'

export function goodsTotal(cart) {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0)
}

export function quote(cart) {
  const shipping = cart.items.length ? shippingCost(totalKg(cart)) : 0
  return { goods: goodsTotal(cart), shipping }
}
