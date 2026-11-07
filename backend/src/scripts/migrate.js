import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../db.js';

const dir = fileURLToPath(new URL('../../../database/migrations/', import.meta.url));

// If the schema was applied by hand before this runner existed, record it
// instead of failing with "relation already exists".
const BASELINE_TABLES = { '001_initial_schema.sql': 'sellers', '002_admin_console.sql': 'admin_users' };

async function tableExists(client, name) {
  const { rows } = await client.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
  return Boolean(rows[0].t);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(20261107)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const done = new Set((await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename));
    const fresh = done.size === 0;
    for (const file of files) {
      if (done.has(file)) continue;
      if (fresh && BASELINE_TABLES[file] && await tableExists(client, BASELINE_TABLES[file])) {
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        console.log(`Already present, recorded: ${file}`);
        continue;
      }
      console.log(`Applying ${file} ...`);
      try {
        await client.query(await readFile(path.join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${file} failed: ${error.message}`);
      }
    }
    console.log('Database is up to date.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(20261107)').catch(() => {});
    client.release();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());

