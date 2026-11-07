import { Router } from 'express';
import { pool } from '../db.js';
import { encryptPII } from '../security.js';

export const safetyReportsRouter = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

safetyReportsRouter.post('/', async (req, res, next) => {
  try {
    const { reportType, details, contactName, contactPhone, privacyConsent } = req.body || {};
    const productId = req.body?.productId || null;
    const orderId = req.body?.orderId || null;
    if (!['product_quality', 'counterfeit', 'reaction', 'labeling', 'other'].includes(reportType)) {
      return res.status(400).json({ error: 'Choose a report type.' });
    }
    if (typeof details !== 'string' || details.trim().length < 10 || details.length > 5000) {
      return res.status(400).json({ error: 'Describe the product or concern in 10 to 5,000 characters.' });
    }
    if (productId && !UUID.test(productId)) return res.status(400).json({ error: 'Choose a valid product.' });
    if (orderId && !UUID.test(orderId)) return res.status(400).json({ error: 'Enter a valid order reference.' });
    if (productId) {
      const { rows } = await pool.query('SELECT id FROM products WHERE id=$1 LIMIT 1', [productId]);
      if (!rows[0]) return res.status(400).json({ error: 'That product could not be found.' });
    }
    if (orderId) {
      const { rows } = await pool.query('SELECT id FROM orders WHERE id=$1 LIMIT 1', [orderId]);
      if (!rows[0]) return res.status(400).json({ error: 'That order could not be found.' });
    }
    if (privacyConsent !== true) return res.status(400).json({ error: 'Consent is required to send a safety report.' });
    let contact = null;
    if (contactName || contactPhone) {
      if (typeof contactName !== 'string' || contactName.trim().length < 2 || contactName.length > 120 ||
          typeof contactPhone !== 'string' || !/^\+?[0-9 ()-]{8,40}$/.test(contactPhone)) {
        return res.status(400).json({ error: 'Enter both a valid name and phone number, or leave both blank.' });
      }
      contact = encryptPII({ name: contactName.trim(), phone: contactPhone.trim() });
    }
    const { rows } = await pool.query(
      `INSERT INTO safety_reports (product_id,order_id,report_type,details_ciphertext,contact_ciphertext)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,status,created_at`,
      [productId, orderId, reportType, encryptPII({ details: details.trim() }), contact],
    );
    res.status(201).json({ report: rows[0], message: 'Thank you. The safety team will review your report.' });
  } catch (error) { next(error); }
});
