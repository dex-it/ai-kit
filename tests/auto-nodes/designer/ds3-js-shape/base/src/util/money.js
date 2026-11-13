export function toMinor(amount) { return Math.round(amount * 100) }
export function fromMinor(minor) { return minor / 100 }
export function formatMoney(minor, currency) { return fromMinor(minor).toFixed(2) + ' ' + currency }
