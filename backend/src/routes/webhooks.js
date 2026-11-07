import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { validChapaSignature } from '../security.js';
import { verifyHostedPayment } from '../chapa.js';

export const webhooksRouter = Router();

webhooksRouter.post('/chapa', async (req, res, next) => {
  try {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody) || !validChapaSignature(rawBody, req.get('x-chapa-signature'))) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }
    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
    const event = JSON.parse(rawBody.toString('utf8'));
    const configuredKey = process.env.CHAPA_PRIVATE_KEY || '';
    const configuredMode = configuredKey.startsWith('CHAPA_TEST_') ? 'test' : configuredKey.startsWith('CHAPA_LIVE_') ? 'live' : null;
    if (event.mode && configuredMode && event.mode !== configuredMode) {
      return res.status(400).json({ error: 'Webhook environment mismatch.' });
    }

    let attempt = null;
    let verified = null;
    const reference = event.merchant_reference;
    if (event.webhook_type === 'payment' && typeof reference === 'string') {
      const { rows } = await pool.query(
        `SELECT id, order_id, amount_cents, currency, status FROM payment_attempts
         WHERE merchant_reference = $1 AND provider = 'chapa' LIMIT 1`, [reference],
      );
      attempt = rows[0] || null;
      if (attempt && attempt.status !== 'success') {
        verified = await verifyHostedPayment(reference);
        const matches = verified.status === 'SUCCESS' && verified.merchant_reference === reference &&
          verified.currency === attempt.currency && Number(verified.amount) === Number(attempt.amount_cents);
        if (verified.status === 'SUCCESS' && !matches) {
          return res.status(409).json({ error: 'Verified payment details do not match the order.' });
        }
      }
    }

    // Store the delivery only after any required provider verification succeeds.
    // A temporary Chapa outage therefore remains retryable by its webhook sender.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const stored = await client.query(
        `INSERT INTO webhook_receipts (provider, payload_sha256, received_at)
         VALUES ('chapa', $1, now()) ON CONFLICT (provider, payload_sha256) DO NOTHING RETURNING payload_sha256`, [digest],
      );
      if (!stored.rowCount) {
        await client.query('COMMIT');
        return res.sendStatus(200);
      }
      if (attempt && attempt.status !== 'success' && verified?.status === 'SUCCESS') {
        await client.query("UPDATE payment_attempts SET status = 'success', chapa_reference = $1, verified_at = now() WHERE id = $2 AND status <> 'success'", [verified.chapa_reference, attempt.id]);
        await client.query("UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = $1 AND status = 'payment_pending'", [attempt.order_id]);
      } else if (attempt && attempt.status !== 'success' && ['FAILED', 'CANCELLED', 'INCOMPLETE', 'BLOCKED'].includes(verified?.status)) {
        const failedAttempt = await client.query("UPDATE payment_attempts SET status = 'failed', verified_at = now() WHERE id = $1 AND status NOT IN ('success','failed') RETURNING id", [attempt.id]);
        if (failedAttempt.rowCount) {
          const failed = await client.query("UPDATE orders SET status = 'payment_failed' WHERE id = $1 AND status = 'payment_pending' RETURNING id", [attempt.order_id]);
          if (failed.rowCount) {
            await client.query(
              `UPDATE products p SET stock_count = p.stock_count + oi.quantity
               FROM order_items oi WHERE oi.order_id = $1 AND p.id = oi.product_id`, [attempt.order_id],
            );
          }
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});
