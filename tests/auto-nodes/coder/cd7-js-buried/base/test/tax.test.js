import test from 'node:test'
import assert from 'node:assert/strict'
import { vat } from '../src/billing/tax.js'

test('НДС по стране', () => {
  assert.equal(vat(100, 'ru'), 20)
  assert.throws(() => vat(100, 'xx'))
})
