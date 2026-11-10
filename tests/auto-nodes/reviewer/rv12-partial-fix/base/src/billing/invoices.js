const GATEWAY = process.env.PAY_GATEWAY_URL ?? 'http://localhost:9000';

export async function fetchInvoice(id, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${GATEWAY}/invoices/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`gateway: ${res.status}`);
  return res.json();
}
