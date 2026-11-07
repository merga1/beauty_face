import crypto from 'node:crypto';
import { pool } from './db.js';
import { constantTimeStringEqual, hashSessionToken, verifyPassword } from './security.js';

const SESSION_SECONDS = 8 * 60 * 60;
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('hex')}$${crypto.scryptSync('beauty-face-invalid-login', Buffer.alloc(16), 64).toString('hex')}`;

function readSessionCookie(request) {
  const cookieHeader = request.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === 'bf_admin_session') return part.slice(separator + 1).trim();
  }
  return '';
}

function setSessionCookie(response, token, maxAge = SESSION_SECONDS) {
  const flags = [`bf_admin_session=${token}`, 'Path=/api/admin', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV === 'production') flags.push('Secure');
  response.setHeader('Set-Cookie', flags.join('; '));
}

export function requireSameOrigin(request, response, next) {
  const origin = request.get('origin');
  if (!origin) return next();
  const allowed = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',').some((value) => {
    try { return new URL(value.trim()).origin === new URL(origin).origin; } catch { return false; }
  });
  if (!allowed) return response.status(403).json({ error: 'This request origin is not allowed.' });
  next();
}

export async function requireAdmin(request, response, next) {
  try {
    const token = readSessionCookie(request);
    if (!/^[a-f0-9]{64}$/i.test(token)) return response.status(401).json({ error: 'Administrator sign-in required.' });
    const { rows } = await pool.query(
      `SELECT a.id, a.email, a.full_name, s.session_hash, s.csrf_token
       FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
       WHERE s.session_hash = $1 AND s.expires_at > now() AND a.is_active = true LIMIT 1`,
      [hashSessionToken(token)],
    );
    if (!rows[0]) return response.status(401).json({ error: 'Administrator session expired. Sign in again.' });
    request.admin = { id: rows[0].id, email: rows[0].email, fullName: rows[0].full_name, csrfToken: rows[0].csrf_token, sessionHash: rows[0].session_hash };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdminCsrf(request, response, next) {
  const supplied = request.get('x-csrf-token');
  if (!constantTimeStringEqual(supplied, request.admin?.csrfToken)) {
    return response.status(403).json({ error: 'Refresh the admin page before submitting changes.' });
  }
  next();
}

export { readSessionCookie, setSessionCookie, SESSION_SECONDS, DUMMY_HASH };
