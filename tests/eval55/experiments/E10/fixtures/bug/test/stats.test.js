import test from 'node:test';
import assert from 'node:assert/strict';
import { mean, median } from '../src/stats.js';

test('mean', () => {
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(mean([]), 0);
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});
