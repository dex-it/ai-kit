export function applyDiscount(price, percent) {
  if (percent < 0 || percent > 90) throw new RangeError('скидка вне 0..90')
  return Math.round(price * (100 - percent)) / 100
}
