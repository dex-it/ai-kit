const ZONES = { msk: 1, spb: 1, ekb: 2, nsk: 3 }

export function zoneOf(city) {
  return ZONES[city] ?? 4
}

export function shippingCost(weightKg, city) {
  return 300 + zoneOf(city) * 100 + Math.ceil(weightKg) * 50
}
