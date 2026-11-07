const baseUrl = () => (process.env.CHAPA_API_BASE || 'https://api.chapa.global/v2').replace(/\/$/, '');

export async function initializeHostedPayment({ amountCents, merchantReference, orderId }) {
  const key = process.env.CHAPA_PRIVATE_KEY;
  if (!key) {
    const error = new Error('Chapa checkout is not configured. Add a Chapa test private key on the server.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${baseUrl()}/payments/hosted`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': merchantReference,
    },
    body: JSON.stringify({
      amount: amountCents,
      currency: 'ETB',
      merchant_reference: merchantReference,
      return_url: `${process.env.WEB_ORIGIN}/checkout/return?order=${encodeURIComponent(orderId)}`,
      meta: { order_id: orderId },
      customization: { title: 'Beauty Face order', description: `Order ${orderId}` },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== 'success' || !result.data?.checkout_url) {
    const error = new Error(result.message || 'Chapa could not initialize this payment.');
    error.status = 502;
    throw error;
  }
  const checkoutUrl = new URL(result.data.checkout_url);
  if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.chapa.global') {
    const error = new Error('Chapa returned an unexpected hosted checkout URL.');
    error.status = 502;
    throw error;
  }
  return checkoutUrl.toString();
}

export async function verifyHostedPayment(reference) {
  const key = process.env.CHAPA_PRIVATE_KEY;
  if (!key) {
    const error = new Error('Chapa checkout is not configured on the server.');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${baseUrl()}/payments/${encodeURIComponent(reference)}/verify`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== 'success' || !result.data) {
    const error = new Error(result.message || 'Could not verify payment with Chapa.');
    error.status = 502;
    throw error;
  }
  return result.data;
}
