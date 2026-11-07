import { pool } from './db.js';

const DEFAULT_CITIES = ['Addis Ababa', 'Adama'];

function envConfig() {
  const cities = (process.env.DELIVERY_CITIES || DEFAULT_CITIES.join(','))
    .split(',').map((city) => city.trim()).filter(Boolean);
  const fees = {};
  for (const pair of (process.env.DELIVERY_FEES_CENTS || '').split(',')) {
    const separator = pair.lastIndexOf(':');
    if (separator < 1) continue;
    const city = pair.slice(0, separator).trim();
    const cents = Number(pair.slice(separator + 1).trim());
    if (city && Number.isSafeInteger(cents) && cents >= 0) fees[city] = cents;
  }
  const fallback = Number(process.env.DELIVERY_FEE_CENTS || 50000);
  for (const city of cities) if (fees[city] === undefined) fees[city] = Number.isSafeInteger(fallback) && fallback >= 0 ? fallback : 50000;
  return { deliveryCities: [...new Set(cities)], deliveryFeesCents: fees };
}

function normalizeDelivery(value) {
  const environment = envConfig();
  const cities = Array.isArray(value?.deliveryCities)
    ? [...new Set(value.deliveryCities.filter((city) => typeof city === 'string').map((city) => city.trim()).filter(Boolean))]
    : [];
  if (!cities.length || cities.length > 30) return environment;
  const fees = {};
  for (const city of cities) {
    const fee = Number(value?.deliveryFeesCents?.[city]);
    fees[city] = Number.isSafeInteger(fee) && fee >= 0 ? fee : environment.deliveryFeesCents[city] ?? 50000;
  }
  return { deliveryCities: cities, deliveryFeesCents: fees };
}

export async function deliveryConfig(queryable = pool) {
  try {
    const { rows } = await queryable.query("SELECT value FROM app_settings WHERE key='delivery' LIMIT 1");
    return rows[0] ? normalizeDelivery(rows[0].value) : envConfig();
  } catch {
    return envConfig();
  }
}

export async function publicConfig() {
  const [delivery, siteResult] = await Promise.all([
    deliveryConfig(),
    pool.query("SELECT value FROM app_settings WHERE key='site' LIMIT 1").catch(() => ({ rows: [] })),
  ]);
  const site = siteResult.rows[0]?.value || {};
  return { ...delivery, site: { announcement: site.announcement || 'Skin-first beauty, made clearer', supportPhone: site.supportPhone || '' } };
}
