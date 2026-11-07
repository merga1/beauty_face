import { pool } from '../db.js';
import { hashPassword } from '../security.js';

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const fullName = process.env.ADMIN_BOOTSTRAP_NAME?.trim();
  if (!email || !password || !fullName) throw new Error('Set ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, and ADMIN_BOOTSTRAP_NAME in the server environment first.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_BOOTSTRAP_EMAIL must be a valid email address under 255 characters.');
  if (fullName.length > 160) throw new Error('ADMIN_BOOTSTRAP_NAME must be 160 characters or fewer.');
  if (password.length < 14) throw new Error('The initial administrator password must be at least 14 characters.');
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(20261105, 1)');
    const { rows } = await client.query('SELECT count(*)::int AS count FROM admin_users');
    if (rows[0].count > 0) throw new Error('Administrator accounts already exist. Create additional administrators in the admin dashboard.');
    await client.query('INSERT INTO admin_users (email,full_name,password_hash) VALUES ($1,$2,$3)', [email, fullName, passwordHash]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  console.log(`Initial administrator created for ${email}. Remove the bootstrap secret from the environment.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
