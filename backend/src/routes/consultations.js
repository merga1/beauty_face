import { Router } from 'express';
import { pool } from '../db.js';
import { encryptPII } from '../security.js';
import { deliveryConfig } from '../config.js';

export const consultationsRouter = Router();

consultationsRouter.post('/', async (req, res, next) => {
  try {
    const { name, phone, city, preferredMode, privacyConsent } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 120) {
      return res.status(400).json({ error: 'Enter a name between 2 and 120 characters.' });
    }
    if (typeof phone !== 'string' || !/^\+?[0-9 ()-]{9,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number.' });
    }
    const siteDelivery = await deliveryConfig();
    if (!siteDelivery.deliveryCities.includes(city)) return res.status(400).json({ error: 'Choose a supported city.' });
    if (!['text', 'voice', 'video'].includes(preferredMode)) {
      return res.status(400).json({ error: 'Choose text, voice, or video as your preference.' });
    }
    if (privacyConsent !== true) return res.status(400).json({ error: 'Consent is required to request a callback.' });

    const contact = encryptPII({ name: name.trim(), phone: phone.trim() });
    const { rows } = await pool.query(
      `INSERT INTO consultation_requests (contact_ciphertext, city, preferred_mode, status, privacy_consent_at)
       VALUES ($1, $2, $3, 'pilot_waitlist', now()) RETURNING id, status, created_at`,
      [contact, city, preferredMode],
    );
    res.status(201).json({ request: rows[0], message: 'Your callback request is on the pilot waitlist.' });
  } catch (error) {
    next(error);
  }
});
