import test from 'node:test'
import assert from 'node:assert/strict'
import { newCart, addItem, totalKg } from '../src/cart.js'
import { CartLimitError } from '../src/errors.js'

test('addItem - вес корзины растёт', () => {
  const cart = addItem(addItem(newCart(), { price: 10, kg: 2, qty: 2 }), { price: 5, kg: 1, qty: 1 })
  assert.equal(totalKg(cart), 5)
})

test('addItem - корзина тяжелее 30 кг не собирается', () => {
  const cart = addItem(newCart(), { price: 10, kg: 25, qty: 1 })
  assert.throws(() => addItem(cart, { price: 10, kg: 6, qty: 1 }), CartLimitError)
  assert.throws(() => addItem(newCart(), { price: 10, kg: 31, qty: 1 }), CartLimitError)
})

test('addItem - вес позиции больше нуля', () => {
  assert.throws(() => addItem(newCart(), { price: 10, kg: 0, qty: 1 }), RangeError)
})
