import { vipDiscount } from './discount.js';

export function cartTotal(items, customer) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.qty;
  }
  if (customer.isVip) {
    total = total - vipDiscount(total);
  }
  return Math.round(total * 100) / 100;
}

export function itemsCount(items) {
  return items.reduce((sum, item) => sum + item.qty, 0);
}
