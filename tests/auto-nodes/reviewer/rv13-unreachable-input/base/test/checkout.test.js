import test from 'node:test'
import assert from 'node:assert/strict'
import { newCart, addItem } from '../src/cart.js'
import { quote } from '../src/checkout.js'

test('quote - сумма товаров', () => {
  const cart = addItem(newCart(), { price: 10, kg: 1, qty: 3 })
  assert.deepEqual(quote(cart), { goods: 30 })
})
