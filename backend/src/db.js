import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

// Cloud databases (Supabase, Neon) require SSL.
// Enable TLS automatically for remote hosts or when specified by PGSSL.
const isRemoteDb = /supabase\.co|supabase\.com|neon\.tech|sslmode=(require|verify-ca|verify-full)/i.test(connectionString || '');
const useTls = process.env.PGSSL !== undefined ? process.env.PGSSL === 'true' : isRemoteDb;

export const pool = new Pool({
  connectionString,
  ssl: useTls ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' } : undefined,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15_000),
});

pool.on('error', (error) => {
  console.error('Unexpected idle PostgreSQL client error', error.message);
});
