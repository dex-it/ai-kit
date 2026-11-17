const TIERS = [
  { upToKg: 1, price: 300 },
  { upToKg: 5, price: 500 },
  { upToKg: 30, price: 1200 },
]

export function shippingCost(kg) {
  if (!(kg > 0)) throw new RangeError(`kg ${kg} <= 0`)
  const tier = TIERS.find(t => kg <= t.upToKg)
  return tier?.price ?? 0
}
