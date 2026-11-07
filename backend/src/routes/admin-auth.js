import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { recordAdminAudit } from '../audit.js';
import { DUMMY_HASH, readSessionCookie, requireAdmin, requireAdminCsrf, requireSameOrigin, SESSION_SECONDS, setSessionCookie } from '../admin-auth.js';
import { hashPassword, hashSessionToken, verifyPassword } from '../security.js';

export const adminAuthRouter = Router();

adminAuthRouter.post('/login', requireSameOrigin, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const { rows } = await pool.query('SELECT id, email, full_name, password_hash, is_active FROM admin_users WHERE email = $1 LIMIT 1', [email]);
    const account = rows[0];
    const passwordMatches = await verifyPassword(password, account?.password_hash || DUMMY_HASH);
    if (!account || !account.is_active || !passwordMatches) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO admin_sessions (admin_id, session_hash, csrf_token, expires_at)
         VALUES ($1, $2, $3, now() + ($4 * interval '1 second'))`,
        [account.id, hashSessionToken(token), csrfToken, SESSION_SECONDS],
      );
      await client.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [account.id]);
      await recordAdminAudit(client, account.id, 'login', 'admin_session');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    setSessionCookie(res, token);
    res.json({ admin: { id: account.id, email: account.email, fullName: account.full_name }, csrfToken });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.get('/session', requireAdmin, (req, res) => {
  res.json({ admin: { id: req.admin.id, email: req.admin.email, fullName: req.admin.fullName }, csrfToken: req.admin.csrfToken });
});

adminAuthRouter.post('/change-password', requireSameOrigin, requireAdmin, requireAdminCsrf, async (req, res, next) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 14 || newPassword.length > 200) return res.status(400).json({ error: 'Use a new password between 14 and 200 characters.' });
    const { rows } = await pool.query('SELECT password_hash FROM admin_users WHERE id=$1 AND is_active=true', [req.admin.id]);
    if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const passwordHash = await hashPassword(newPassword);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE admin_users SET password_hash=$1 WHERE id=$2', [passwordHash, req.admin.id]);
      await client.query('DELETE FROM admin_sessions WHERE admin_id=$1 AND session_hash<>$2', [req.admin.id, req.admin.sessionHash]);
      await recordAdminAudit(client, req.admin.id, 'change_password', 'administrator', req.admin.id);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminAuthRouter.post('/logout', requireSameOrigin, requireAdmin, requireAdminCsrf, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM admin_sessions WHERE session_hash = $1', [req.admin.sessionHash]);
    setSessionCookie(res, '', 0);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
