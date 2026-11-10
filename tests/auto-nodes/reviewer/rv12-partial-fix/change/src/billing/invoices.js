const GATEWAY = process.env.PAY_GATEWAY_URL ?? 'http://localhost:9000';
const GATEWAY_TIMEOUT_MS = 10_000;

export async function fetchInvoice(id, { fetchImpl = fetch, timeoutMs = GATEWAY_TIMEOUT_MS } = {}) {
  let res;
  try {
    res = await fetchImpl(`${GATEWAY}/invoices/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err?.name === 'TimeoutError') throw new Error('gateway: timeout');
    throw err;
  }
  if (!res.ok) throw new Error(`gateway: ${res.status}`);
  return res.json();
}
