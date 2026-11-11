const RATES = { ru: 0.2, kz: 0.12, by: 0.2 }

export function vat(amount, country) {
  const rate = RATES[country]
  if (rate === undefined) throw new Error(`нет ставки НДС для ${country}`)
  return Math.round(amount * rate * 100) / 100
}
