import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, fmtPct } from '../src/format.js';

test('fmt', () => {
  assert.equal(fmt(1.234), '1.23');
  assert.equal(fmt(null), '');
});

test('fmtPct', () => {
  assert.equal(fmtPct(0.5), '50.0%');
});
