import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchInvoice } from '../src/billing/invoices.js';

const answer = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
const silent = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));

test('счёт из ответа шлюза', async () => {
  assert.deepEqual(await fetchInvoice('7', { fetchImpl: answer(200, { id: '7' }) }), { id: '7' });
});

test('отказ шлюза - ошибка со статусом', async () => {
  await assert.rejects(fetchInvoice('7', { fetchImpl: answer(502) }), /gateway: 502/);
});

test('шлюз молчит - обрыв по потолку', async () => {
  await assert.rejects(fetchInvoice('7', { fetchImpl: silent, timeoutMs: 20 }), /gateway: timeout/);
});
