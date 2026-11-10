const GATEWAY = process.env.PAY_GATEWAY_URL ?? 'http://localhost:9000';

export async function fetchRefund(id, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${GATEWAY}/refunds/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`gateway: ${res.status}`);
  return res.json();
}

export async function refundsOf(invoice, opts) {
  return Promise.all(invoice.refundIds.map((id) => fetchRefund(id, opts)));
}
