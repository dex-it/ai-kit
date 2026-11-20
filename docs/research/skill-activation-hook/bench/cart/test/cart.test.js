import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal, itemsCount } from '../src/cart.js';

test('обычный покупатель платит полную сумму', () => {
  assert.equal(cartTotal([{ price: 100, qty: 2 }], { isVip: false }), 200);
});

test('VIP получает скидку 10%', () => {
  assert.equal(cartTotal([{ price: 100, qty: 2 }], { isVip: true }), 180);
});

test('VIP на крупной корзине тоже 10%', () => {
  assert.equal(cartTotal([{ price: 600, qty: 2 }], { isVip: true }), 1080);
});

test('число товаров', () => {
  assert.equal(itemsCount([{ price: 1, qty: 2 }, { price: 1, qty: 3 }]), 5);
});
