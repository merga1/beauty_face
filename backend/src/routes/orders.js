import { Router } from 'express';
import { pool } from '../db.js';
import { initializeHostedPayment, verifyHostedPayment } from '../chapa.js';
import { contactLookupHash, encryptPII, newMerchantReference } from '../security.js';
import { deliveryConfig } from '../config.js';

export const ordersRouter = Router();

ordersRouter.post('/', async (req, res, next) => {
  const { items, customer, delivery } = req.body || {};
  if (!process.env.CHAPA_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Chapa checkout is not configured. Add a Chapa test private key on the server.' });
  }
  const siteDelivery = await deliveryConfig();
  const allowedCities = siteDelivery.deliveryCities;
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return res.status(400).json({ error: 'Add between 1 and 30 different items.' });
  }
  if (!customer || typeof customer.name !== 'string' || customer.name.trim().length < 2 || customer.name.length > 120 ||
      typeof customer.phone !== 'string' || !/^\+?[0-9 ()-]{9,20}$/.test(customer.phone)) {
    return res.status(400).json({ error: 'Enter a valid name and phone number.' });
  }
  if (!delivery || !allowedCities.includes(delivery.city) ||
      !['subcity', 'woreda', 'landmark'].every((key) => typeof delivery[key] === 'string' && delivery[key].trim().length > 0 && delivery[key].length <= 160)) {
    return res.status(400).json({ error: 'Enter a supported city, sub-city, woreda, and landmark.' });
  }
  if (items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    return res.status(400).json({ error: 'Each item must include a product ID and quantity.' });
  }
  const normalizedItems = items.map(({ productId, quantity }) => ({ productId, quantity: Number(quantity) }));
  if (normalizedItems.some((item) => typeof item.productId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) ||
      new Set(normalizedItems.map((item) => item.productId)).size !== normalizedItems.length) {
    return res.status(400).json({ error: 'Each product needs a valid ID and a quantity between 1 and 20.' });
  }

  const client = await pool.connect();
  let order;
  let reference;
  try {
    await client.query('BEGIN');
    const ids = normalizedItems.map((item) => item.productId);
    const { rows: products } = await client.query(
      `SELECT id, name, price_cents, stock_count FROM products
       WHERE id = ANY($1::uuid[]) AND published = true ORDER BY id FOR UPDATE`, [ids],
    );
    if (products.length !== ids.length) throw Object.assign(new Error('One or more products are no longer available.'), { status: 409 });
    const byId = new Map(products.map((product) => [product.id, product]));
    let subtotal = 0;
    for (const item of normalizedItems) {
      const product = byId.get(item.productId);
      if (product.stock_count < item.quantity) throw Object.assign(new Error(`${product.name} does not have enough stock.`), { status: 409 });
      subtotal += Number(product.price_cents) * item.quantity;
    }
    const fee = siteDelivery.deliveryFeesCents[delivery.city] ?? 50000;
    const total = subtotal + fee;
    const normalizedName = customer.name.trim();
    const normalizedPhone = customer.phone.trim();
    const contact = encryptPII({ name: normalizedName, phone: normalizedPhone });
    const customerRecord = await client.query(
      `INSERT INTO customers (phone_lookup_hash, name_ciphertext, phone_ciphertext)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone_lookup_hash) DO UPDATE SET
         name_ciphertext = EXCLUDED.name_ciphertext,
         phone_ciphertext = EXCLUDED.phone_ciphertext,
         updated_at = now()
       RETURNING id, status`,
      [contactLookupHash(normalizedPhone), encryptPII({ name: normalizedName }), encryptPII({ phone: normalizedPhone })],
    );
    if (!customerRecord.rows[0] || customerRecord.rows[0].status !== 'active') {
      throw Object.assign(new Error('This customer account cannot place orders. Contact support for help.'), { status: 403 });
    }
    const address = encryptPII({ city: delivery.city, subcity: delivery.subcity.trim(), woreda: delivery.woreda.trim(), landmark: delivery.landmark.trim() });
    const inserted = await client.query(
      `INSERT INTO orders (customer_id, customer_ciphertext, delivery_ciphertext, currency, subtotal_cents, delivery_fee_cents, total_cents, status)
       VALUES ($1, $2, $3, 'ETB', $4, $5, $6, 'payment_pending') RETURNING id, status, total_cents, currency`,
      [customerRecord.rows[0].id, contact, address, subtotal, fee, total],
    );
    order = inserted.rows[0];
    for (const item of normalizedItems) {
      const product = byId.get(item.productId);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price_cents)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, product.id, product.name, item.quantity, product.price_cents],
      );
      await client.query('UPDATE products SET stock_count = stock_count - $1 WHERE id = $2', [item.quantity, product.id]);
    }
    reference = newMerchantReference();
    await client.query(
      `INSERT INTO payment_attempts (order_id, provider, merchant_reference, amount_cents, currency, status)
       VALUES ($1, 'chapa', $2, $3, 'ETB', 'initializing')`,
      [order.id, reference, total],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    return next(error);
  }
  client.release();

  try {
    const checkoutUrl = await initializeHostedPayment({ amountCents: Number(order.total_cents), merchantReference: reference, orderId: order.id });
    await pool.query("UPDATE payment_attempts SET status = 'pending' WHERE merchant_reference = $1 AND status = 'initializing'", [reference]);
    res.status(201).json({ order: { ...order, total_cents: Number(order.total_cents) }, checkoutUrl });
  } catch (error) {
    const releaseClient = await pool.connect();
    try {
      await releaseClient.query('BEGIN');
      const failedAttempt = await releaseClient.query(
        `UPDATE payment_attempts SET status = 'initialization_failed'
         WHERE merchant_reference = $1 AND status = 'initializing' RETURNING order_id`, [reference],
      );
      if (failedAttempt.rowCount) {
        await releaseClient.query("UPDATE orders SET status = 'payment_failed' WHERE id = $1 AND status = 'payment_pending'", [order.id]);
        await releaseClient.query(
          `UPDATE products p SET stock_count = p.stock_count + oi.quantity
           FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`, [order.id],
        );
      }
      await releaseClient.query('COMMIT');
    } catch (releaseError) {
      await releaseClient.query('ROLLBACK').catch(() => {});
      console.error('Failed to release stock after checkout initialization error:', releaseError.message);
    } finally {
      releaseClient.release();
    }
    next(error);
  }
});

ordersRouter.get('/:id/payment-status', async (req, res, next) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid order ID.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.status AS order_status, o.total_cents, o.currency,
              p.merchant_reference, p.status AS payment_status
       FROM orders o JOIN payment_attempts p ON p.order_id = o.id
       WHERE o.id = $1 ORDER BY p.created_at DESC LIMIT 1`, [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
    const attempt = rows[0];
    if (attempt.payment_status === 'pending' || attempt.payment_status === 'initializing') {
      const verified = await verifyHostedPayment(attempt.merchant_reference);
      const matches = verified.status === 'SUCCESS' && verified.merchant_reference === attempt.merchant_reference &&
        verified.currency === attempt.currency && Number(verified.amount) === Number(attempt.total_cents);
      if (matches) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query("UPDATE payment_attempts SET status = 'success', chapa_reference = $1, verified_at = now() WHERE merchant_reference = $2 AND status <> 'success'", [verified.chapa_reference, attempt.merchant_reference]);
          await client.query("UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = $1 AND status = 'payment_pending'", [attempt.id]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
        attempt.order_status = 'paid';
        attempt.payment_status = 'success';
      } else if (['FAILED', 'CANCELLED', 'INCOMPLETE', 'BLOCKED'].includes(verified.status)) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const failedAttempt = await client.query("UPDATE payment_attempts SET status = 'failed', verified_at = now() WHERE merchant_reference = $1 AND status NOT IN ('success','failed') RETURNING id", [attempt.merchant_reference]);
          if (failedAttempt.rowCount) {
            const failed = await client.query("UPDATE orders SET status = 'payment_failed' WHERE id = $1 AND status = 'payment_pending' RETURNING id", [attempt.id]);
            if (failed.rowCount) {
              await client.query(
                `UPDATE products p SET stock_count = p.stock_count + oi.quantity
                 FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`, [attempt.id],
              );
            }
            attempt.order_status = 'payment_failed';
            attempt.payment_status = 'failed';
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      }
    }
    res.json({ orderId: attempt.id, orderStatus: attempt.order_status, paymentStatus: attempt.payment_status, totalCents: Number(attempt.total_cents), currency: attempt.currency });
  } catch (error) {
    next(error);
  }
});
