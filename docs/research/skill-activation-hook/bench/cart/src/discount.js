export const VIP_RATE = 0.1;

export function vipDiscount(total) {
  const discount = total * VIP_RATE;
  return total > 1000 ? discount * 2 : discount;
}
