export function goodsTotal(cart) {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0)
}

export function quote(cart) {
  return { goods: goodsTotal(cart) }
}
