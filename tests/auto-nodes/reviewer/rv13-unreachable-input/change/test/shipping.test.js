import test from 'node:test'
import assert from 'node:assert/strict'
import { shippingCost } from '../src/shipping.js'

test('shippingCost - ступени по весу (R1)', () => {
  assert.equal(shippingCost(0.5), 300)
  assert.equal(shippingCost(1), 300)
  assert.equal(shippingCost(1.01), 500)
  assert.equal(shippingCost(5), 500)
  assert.equal(shippingCost(5.5), 1200)
  assert.equal(shippingCost(30), 1200)
})

test('shippingCost - вес не больше нуля или не число - RangeError (R2)', () => {
  assert.throws(() => shippingCost(0), RangeError)
  assert.throws(() => shippingCost(-1), RangeError)
  assert.throws(() => shippingCost(NaN), RangeError)
})
