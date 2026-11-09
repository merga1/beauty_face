import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { recordAdminAudit } from '../audit.js';
import { requireAdmin, requireAdminCsrf, requireSameOrigin } from '../admin-auth.js';
import { adminAuthRouter } from './admin-auth.js';
import { decryptPII, encryptPII, hashPassword, contactLookupHash } from '../security.js';
import { deliveryConfig } from '../config.js';

export const adminRouter = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/;

const PRODUCT_RETURNING = `id, seller_id, slug, name, brand, category, description, price_cents,
  skin_types, concerns, ingredients, how_to_use, warnings, supplier_verification,
  expiry_information, sample_listing, published, stock_count, created_at, updated_at,
  CASE WHEN image_data IS NOT NULL THEN '/api/products/' || slug || '/image' END AS image_url`;

function looksLikeImage(buffer, mime) {
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mime === 'image/png') return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (mime === 'image/gif') return buffer.subarray(0, 3).toString('ascii') === 'GIF';
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function parseImage(body) {
  if (body?.removeImage === true) return { remove: true, data: null, mime: null };
  const raw = body?.image;
  if (raw === undefined || raw === null || raw === '') return { remove: false, data: null, mime: null };
  if (typeof raw !== 'string') fail('Upload a valid image file.');
  const match = IMAGE_DATA_URL.exec(raw);
  if (!match) fail('Upload a JPEG, PNG, WebP, or GIF image.');
  const mime = match[1];
  const data = Buffer.from(match[2], 'base64');
  if (!data.length) fail('The image file is empty.');
  if (data.length > MAX_IMAGE_BYTES) fail('Images must be 5 MB or smaller.');
  if (!looksLikeImage(data, mime)) fail('The uploaded file is not a valid image.');
  return { remove: false, data, mime };
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function checkId(id) {
  if (!UUID.test(id || '')) fail('Invalid record ID.', 400);
}

function text(value, label, max = 200, required = true) {
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) return '';
    fail(`${label} is required.`);
  }
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) fail(`${label} must be ${required ? 'present and ' : ''}under ${max} characters.`);
  return clean;
}

function stringArray(value, label, max = 100) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  if (values.length > 40 || values.some((item) => typeof item !== 'string' || item.trim().length > max)) fail(`${label} contains an invalid entry.`);
  return values.map((item) => item.trim()).filter(Boolean);
}

function parseProduct(body) {
  const name = text(body.name, 'Product name', 160);
  const slug = text(body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 'Slug', 180);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('Use lowercase letters, numbers, and hyphens for the slug.');
  const priceEtb = Number(body.priceEtb);
  const stockCount = Number(body.stockCount);
  const verification = body.supplierVerification || 'pending';
  if (!Number.isFinite(priceEtb) || priceEtb < 0 || priceEtb > 10000000) fail('Enter a valid price in ETB.');
  if (!Number.isInteger(stockCount) || stockCount < 0 || stockCount > 1000000) fail('Enter a valid stock count.');
  if (!['pending', 'verified', 'rejected'].includes(verification)) fail('Choose a valid supplier verification state.');
  const sellerId = body.sellerId || null;
  if (sellerId && !UUID.test(sellerId)) fail('Choose a valid seller.');
  const sampleListing = body.sampleListing === true;
  const published = body.published === true;
  if (published && !sampleListing && verification !== 'verified') fail('Verify the supplier before publishing a real product listing.', 409);
  return {
    name, slug, brand: text(body.brand, 'Brand', 120), category: text(body.category, 'Category', 80),
    description: text(body.description, 'Description', 2000), priceCents: Math.round(priceEtb * 100),
    skinTypes: stringArray(body.skinTypes, 'Skin types'), concerns: stringArray(body.concerns, 'Concerns'),
    ingredients: stringArray(body.ingredients, 'Ingredients'), howToUse: text(body.howToUse || '', 'How to use', 2000, false),
    warnings: stringArray(body.warnings, 'Warnings'), expiryInformation: text(body.expiryInformation || 'Expiry details not provided.', 'Expiry details', 500, false),
    supplierVerification: verification, sampleListing, published, stockCount, sellerId,
    image: parseImage(body),
  };
}

function safeDecrypt(value) {
  if (!value || Buffer.from(value).length < 30) return null;
  try { return decryptPII(value); } catch { return null; }
}

adminRouter.use('/auth', adminAuthRouter);
adminRouter.use((req, res, next) => {
  requireSameOrigin(req, res, (originError) => {
    if (originError) return next(originError);
    requireAdmin(req, res, (authError) => {
      if (authError) return next(authError);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return requireAdminCsrf(req, res, next);
      next();
    });
  });
});

adminRouter.get('/overview', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*) FROM products) AS products,
        (SELECT count(*) FROM products WHERE published = true) AS published_products,
        (SELECT count(*) FROM orders) AS orders,
        (SELECT count(*) FROM orders WHERE status IN ('payment_pending','paid','preparing','dispatched')) AS open_orders,
        (SELECT count(*) FROM customers WHERE status = 'active') AS customers,
        (SELECT count(*) FROM sellers WHERE verification_status = 'pending') AS pending_sellers,
        (SELECT count(*) FROM doctors WHERE license_status = 'pending') AS pending_doctors,
        (SELECT count(*) FROM consultation_requests WHERE status = 'pilot_waitlist') AS callback_requests,
        (SELECT count(*) FROM safety_reports WHERE status IN ('new','in_review','escalated')) AS safety_reports,
        (SELECT count(*) FROM articles WHERE status = 'published') AS published_articles
    `);
    res.json({ overview: rows[0] });
  } catch (error) { next(error); }
});

adminRouter.get('/products', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.seller_id, p.slug, p.name, p.brand, p.category, p.description, p.price_cents,
         p.skin_types, p.concerns, p.ingredients, p.how_to_use, p.warnings, p.supplier_verification,
         p.expiry_information, p.sample_listing, p.published, p.stock_count, p.created_at, p.updated_at,
         CASE WHEN p.image_data IS NOT NULL THEN '/api/products/' || p.slug || '/image' END AS image_url,
         s.display_name AS seller_name
       FROM products p LEFT JOIN sellers s ON s.id = p.seller_id ORDER BY p.updated_at DESC LIMIT 500`,
    );
    res.json({ products: rows.map((product) => ({ ...product, priceEtb: Number(product.price_cents) / 100 })) });
  } catch (error) { next(error); }
});

adminRouter.post('/products', async (req, res, next) => {
  try {
    const product = parseProduct(req.body || {});
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products (seller_id, slug, name, brand, category, description, price_cents, skin_types, concerns,
          ingredients, how_to_use, warnings, expiry_information, supplier_verification, sample_listing, published, stock_count,
          image_data, image_mime, image_updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
           CASE WHEN $18::bytea IS NOT NULL THEN now() END)
         RETURNING ${PRODUCT_RETURNING}`,
        [product.sellerId, product.slug, product.name, product.brand, product.category, product.description, product.priceCents,
          product.skinTypes, product.concerns, product.ingredients, product.howToUse, product.warnings, product.expiryInformation,
          product.supplierVerification, product.sampleListing, product.published, product.stockCount,
          product.image.data, product.image.mime],
      );
      await recordAdminAudit(client, req.admin.id, 'create', 'product', rows[0].id, {
        slug: product.slug, published: product.published, imageAdded: Boolean(product.image.data),
      });
      return rows[0];
    });
    res.status(201).json({ product: { ...result, priceEtb: Number(result.price_cents) / 100 } });
  } catch (error) { next(error); }
});

adminRouter.patch('/products/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const product = parseProduct(req.body || {});
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE products SET seller_id=$1, slug=$2, name=$3, brand=$4, category=$5, description=$6, price_cents=$7,
          skin_types=$8, concerns=$9, ingredients=$10, how_to_use=$11, warnings=$12, expiry_information=$13,
          supplier_verification=$14, sample_listing=$15, published=$16, stock_count=$17,
          image_data=CASE WHEN $18 THEN NULL WHEN $19::bytea IS NOT NULL THEN $19 ELSE image_data END,
          image_mime=CASE WHEN $18 THEN NULL WHEN $19::bytea IS NOT NULL THEN $20 ELSE image_mime END,
          image_updated_at=CASE WHEN $18 OR $19::bytea IS NOT NULL THEN now() ELSE image_updated_at END,
          updated_at=now()
         WHERE id=$21 RETURNING ${PRODUCT_RETURNING}`,
        [product.sellerId, product.slug, product.name, product.brand, product.category, product.description, product.priceCents,
          product.skinTypes, product.concerns, product.ingredients, product.howToUse, product.warnings, product.expiryInformation,
          product.supplierVerification, product.sampleListing, product.published, product.stockCount,
          product.image.remove, product.image.data, product.image.mime, req.params.id],
      );
      if (!rows[0]) fail('Product not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update', 'product', req.params.id, {
        slug: product.slug, published: product.published,
        imageAdded: Boolean(product.image.data), imageRemoved: product.image.remove,
      });
      return rows[0];
    });
    res.json({ product: { ...result, priceEtb: Number(result.price_cents) / 100 } });
  } catch (error) { next(error); }
});

adminRouter.delete('/products/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const { rows } = await client.query('DELETE FROM products WHERE id=$1 RETURNING id, slug, name', [req.params.id]);
      if (!rows[0]) fail('Product not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'delete', 'product', req.params.id, { slug: rows[0].slug, name: rows[0].name });
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.get('/sellers', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT s.*, count(p.id)::int AS product_count FROM sellers s LEFT JOIN products p ON p.seller_id=s.id GROUP BY s.id ORDER BY s.created_at DESC`);
    res.json({ sellers: rows });
  } catch (error) { next(error); }
});

adminRouter.post('/sellers', async (req, res, next) => {
  try {
    const displayName = text(req.body?.displayName, 'Seller name', 160);
    const status = req.body?.verificationStatus || 'pending';
    if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) fail('Choose a valid seller status.');
    const result = await transaction(async (client) => {
      const { rows } = await client.query('INSERT INTO sellers (display_name, verification_status) VALUES ($1,$2) RETURNING *', [displayName, status]);
      await recordAdminAudit(client, req.admin.id, 'create', 'seller', rows[0].id, { verificationStatus: status });
      return rows[0];
    });
    res.status(201).json({ seller: result });
  } catch (error) { next(error); }
});

adminRouter.patch('/sellers/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const displayName = text(req.body?.displayName, 'Seller name', 160);
    const status = req.body?.verificationStatus;
    if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) fail('Choose a valid seller status.');
    const result = await transaction(async (client) => {
      const { rows } = await client.query('UPDATE sellers SET display_name=$1, verification_status=$2 WHERE id=$3 RETURNING *', [displayName, status, req.params.id]);
      if (!rows[0]) fail('Seller not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update', 'seller', req.params.id, { verificationStatus: status });
      return rows[0];
    });
    res.json({ seller: result });
  } catch (error) { next(error); }
});

adminRouter.delete('/sellers/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const { rows } = await client.query("UPDATE sellers SET verification_status='suspended' WHERE id=$1 RETURNING id", [req.params.id]);
      if (!rows[0]) fail('Seller not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'suspend', 'seller', req.params.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.get('/doctors', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, display_name, license_ciphertext, license_status, specialties, languages, created_at, verified_at FROM doctors ORDER BY created_at DESC');
    const doctors = rows.map((doctor) => {
      const license = safeDecrypt(doctor.license_ciphertext)?.licenseNumber || '';
      return { ...doctor, licenseCiphertext: undefined, licenseMasked: license ? `••••${license.slice(-4)}` : '' };
    });
    res.json({ doctors });
  } catch (error) { next(error); }
});

adminRouter.post('/doctors', async (req, res, next) => {
  try {
    const name = text(req.body?.displayName, 'Clinician name', 160);
    const licenseNumber = text(req.body?.licenseNumber, 'License number', 120);
    const status = req.body?.licenseStatus || 'pending';
    if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) fail('Choose a valid license status.');
    const specialties = stringArray(req.body?.specialties, 'Specialties');
    const languages = stringArray(req.body?.languages, 'Languages');
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO doctors (display_name, license_ciphertext, license_status, specialties, languages, verified_at)
         VALUES ($1,$2,$3,$4,$5,CASE WHEN $3='verified' THEN now() END) RETURNING id, display_name, license_status, specialties, languages, created_at, verified_at`,
        [name, encryptPII({ licenseNumber }), status, specialties, languages],
      );
      await recordAdminAudit(client, req.admin.id, 'create', 'doctor', rows[0].id, { licenseStatus: status });
      return rows[0];
    });
    res.status(201).json({ doctor: { ...result, licenseMasked: `••••${licenseNumber.slice(-4)}` } });
  } catch (error) { next(error); }
});

adminRouter.patch('/doctors/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const name = text(req.body?.displayName, 'Clinician name', 160);
    const status = req.body?.licenseStatus;
    if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) fail('Choose a valid license status.');
    const specialties = stringArray(req.body?.specialties, 'Specialties');
    const languages = stringArray(req.body?.languages, 'Languages');
    const licenseNumber = typeof req.body?.licenseNumber === 'string' && req.body.licenseNumber.trim()
      ? text(req.body.licenseNumber, 'License number', 120) : '';
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE doctors SET display_name=$1, license_status=$2, specialties=$3, languages=$4,
          license_ciphertext=CASE WHEN $5='' THEN license_ciphertext ELSE $6 END,
          verified_at=CASE WHEN $2='verified' THEN COALESCE(verified_at,now()) ELSE NULL END
         WHERE id=$7 RETURNING id, display_name, license_status, specialties, languages, created_at, verified_at`,
        [name, status, specialties, languages, licenseNumber, licenseNumber ? encryptPII({ licenseNumber }) : null, req.params.id],
      );
      if (!rows[0]) fail('Clinician not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update', 'doctor', req.params.id, { licenseStatus: status });
      return rows[0];
    });
    res.json({ doctor: result });
  } catch (error) { next(error); }
});

adminRouter.delete('/doctors/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const { rows } = await client.query("UPDATE doctors SET license_status='suspended', verified_at=NULL WHERE id=$1 RETURNING id", [req.params.id]);
      if (!rows[0]) fail('Clinician not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'suspend', 'doctor', req.params.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.get('/consultation-requests', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.city, r.preferred_mode, r.status, r.created_at, r.privacy_consent_at,
         r.contact_ciphertext, r.doctor_id, d.display_name AS doctor_name
       FROM consultation_requests r LEFT JOIN doctors d ON d.id=r.doctor_id ORDER BY r.created_at DESC LIMIT 500`,
    );
    res.json({ requests: rows.map((row) => ({ ...row, ...safeDecrypt(row.contact_ciphertext), contact_ciphertext: undefined })) });
  } catch (error) { next(error); }
});

adminRouter.patch('/consultation-requests/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const status = req.body?.status;
    if (!['pilot_waitlist', 'requested', 'scheduled', 'completed', 'cancelled'].includes(status)) fail('Choose a valid request status.');
    const doctorId = req.body?.doctorId || null;
    if (doctorId) checkId(doctorId);
    const result = await transaction(async (client) => {
      const { rows } = await client.query('UPDATE consultation_requests SET status=$1, doctor_id=$2 WHERE id=$3 RETURNING id,status,city,preferred_mode,created_at', [status, doctorId, req.params.id]);
      if (!rows[0]) fail('Callback request not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update', 'consultation_request', req.params.id, { status, doctorId });
      return rows[0];
    });
    res.json({ request: result });
  } catch (error) { next(error); }
});

adminRouter.delete('/consultation-requests/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const { rows } = await client.query("UPDATE consultation_requests SET status='cancelled', contact_ciphertext=''::bytea WHERE id=$1 RETURNING id", [req.params.id]);
      if (!rows[0]) fail('Callback request not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'erase_contact', 'consultation_request', req.params.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.get('/orders', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.id, o.customer_ciphertext, o.delivery_ciphertext, o.status, o.currency,
        o.subtotal_cents, o.delivery_fee_cents, o.total_cents, o.created_at, o.paid_at,
        c.name_ciphertext, c.phone_ciphertext,
        (SELECT p.status FROM payment_attempts p WHERE p.order_id=o.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status,
        (SELECT p.merchant_reference FROM payment_attempts p WHERE p.order_id=o.id ORDER BY p.created_at DESC LIMIT 1) AS merchant_reference,
        (SELECT da.rider_id FROM delivery_assignments da WHERE da.order_id=o.id LIMIT 1) AS rider_id,
        (SELECT r.display_name FROM delivery_assignments da JOIN delivery_riders r ON r.id=da.rider_id WHERE da.order_id=o.id LIMIT 1) AS rider_name,
        (SELECT da.status FROM delivery_assignments da WHERE da.order_id=o.id LIMIT 1) AS delivery_status,
        COALESCE(json_agg(json_build_object('name',oi.product_name_snapshot,'quantity',oi.quantity,'unitPriceCents',oi.unit_price_cents)) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) AS items
      FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN order_items oi ON oi.order_id=o.id
      GROUP BY o.id,c.id ORDER BY o.created_at DESC LIMIT 500
    `);
    const orders = rows.map((order) => {
      const guest = safeDecrypt(order.customer_ciphertext);
      const customer = guest || { name: safeDecrypt(order.name_ciphertext)?.name, phone: safeDecrypt(order.phone_ciphertext)?.phone };
      return {
        id: order.id, status: order.status, currency: order.currency, subtotalCents: Number(order.subtotal_cents),
        deliveryFeeCents: Number(order.delivery_fee_cents), totalCents: Number(order.total_cents),
        createdAt: order.created_at, paidAt: order.paid_at, paymentStatus: order.payment_status,
        merchantReference: order.merchant_reference, customerName: customer?.name || 'Deleted customer',
        customerPhone: customer?.phone || '', delivery: safeDecrypt(order.delivery_ciphertext), items: order.items,
        riderId: order.rider_id, riderName: order.rider_name, deliveryStatus: order.delivery_status,
      };
    });
    res.json({ orders });
  } catch (error) { next(error); }
});

adminRouter.patch('/orders/:id/status', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const nextStatus = req.body?.status;
    const transitions = { paid: ['preparing'], preparing: ['dispatched'], dispatched: ['delivered'] };
    const updated = await transaction(async (client) => {
      const current = await client.query('SELECT status FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!current.rows[0]) fail('Order not found.', 404);
      if (!transitions[current.rows[0].status]?.includes(nextStatus)) fail('That order status transition is not allowed.', 409);
      const { rows } = await client.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status', [nextStatus, req.params.id]);
      if (nextStatus === 'delivered') {
        await client.query("UPDATE delivery_assignments SET status='delivered',completed_at=COALESCE(completed_at,now()) WHERE order_id=$1", [req.params.id]);
      }
      await recordAdminAudit(client, req.admin.id, 'update_status', 'order', req.params.id, { from: current.rows[0].status, to: nextStatus });
      return rows[0];
    });
    res.json({ order: updated });
  } catch (error) { next(error); }
});

adminRouter.get('/riders', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,display_name,phone_ciphertext,vehicle_type,status,created_at FROM delivery_riders ORDER BY created_at DESC');
    res.json({ riders: rows.map((rider) => ({ id: rider.id, displayName: rider.display_name, phone: safeDecrypt(rider.phone_ciphertext)?.phone || '', vehicleType: rider.vehicle_type, status: rider.status, createdAt: rider.created_at })) });
  } catch (error) { next(error); }
});

adminRouter.post('/riders', async (req, res, next) => {
  try {
    const displayName = text(req.body?.displayName, 'Rider name', 160);
    const phone = text(req.body?.phone, 'Rider phone', 40);
    if (!/^\+?[0-9 ()-]{8,40}$/.test(phone)) fail('Enter a valid rider phone number.');
    const vehicleType = text(req.body?.vehicleType || 'motorcycle', 'Vehicle type', 80);
    const status = req.body?.status || 'pending';
    if (!['pending', 'active', 'suspended'].includes(status)) fail('Choose a valid rider status.');
    const rider = await transaction(async (client) => {
      const { rows } = await client.query('INSERT INTO delivery_riders (display_name,phone_ciphertext,vehicle_type,status) VALUES ($1,$2,$3,$4) RETURNING id,display_name,vehicle_type,status,created_at', [displayName, encryptPII({ phone }), vehicleType, status]);
      await recordAdminAudit(client, req.admin.id, 'create', 'delivery_rider', rows[0].id, { status, vehicleType });
      return rows[0];
    });
    res.status(201).json({ rider: { ...rider, phone } });
  } catch (error) { next(error); }
});

adminRouter.patch('/riders/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const displayName = text(req.body?.displayName, 'Rider name', 160);
    const vehicleType = text(req.body?.vehicleType || 'motorcycle', 'Vehicle type', 80);
    const phone = typeof req.body?.phone === 'string' && req.body.phone.trim() ? text(req.body.phone, 'Rider phone', 40) : '';
    if (phone && !/^\+?[0-9 ()-]{8,40}$/.test(phone)) fail('Enter a valid rider phone number.');
    const status = req.body?.status;
    if (!['pending', 'active', 'suspended'].includes(status)) fail('Choose a valid rider status.');
    const rider = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE delivery_riders SET display_name=$1,vehicle_type=$2,status=$3,
          phone_ciphertext=CASE WHEN $4='' THEN phone_ciphertext ELSE $5 END,updated_at=now()
         WHERE id=$6 RETURNING id,display_name,vehicle_type,status,created_at`,
        [displayName, vehicleType, status, phone, phone ? encryptPII({ phone }) : null, req.params.id],
      );
      if (!rows[0]) fail('Rider not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update', 'delivery_rider', req.params.id, { status, vehicleType });
      return rows[0];
    });
    res.json({ rider: { ...rider, phone: phone || '' } });
  } catch (error) { next(error); }
});

adminRouter.delete('/riders/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const { rows } = await client.query("UPDATE delivery_riders SET status='suspended',updated_at=now() WHERE id=$1 RETURNING id", [req.params.id]);
      if (!rows[0]) fail('Rider not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'suspend', 'delivery_rider', req.params.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.post('/orders/:id/assign-rider', async (req, res, next) => {
  try {
    checkId(req.params.id); checkId(req.body?.riderId);
    const result = await transaction(async (client) => {
      const orderResult = await client.query('SELECT id,status FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!orderResult.rows[0]) fail('Order not found.', 404);
      const riderResult = await client.query("SELECT id,status FROM delivery_riders WHERE id=$1 FOR UPDATE", [req.body.riderId]);
      if (!riderResult.rows[0] || riderResult.rows[0].status !== 'active') fail('Choose an active delivery rider.', 409);
      const current = await client.query('SELECT status FROM delivery_assignments WHERE order_id=$1 FOR UPDATE', [req.params.id]);
      const orderStatus = orderResult.rows[0].status;
      if (!['preparing', 'dispatched'].includes(orderStatus) || (current.rows[0] && current.rows[0].status !== 'assigned')) {
        fail('Only prepared orders, or orders with an unstarted rider assignment, can be assigned.', 409);
      }
      const assignment = await client.query(
        `INSERT INTO delivery_assignments (order_id,rider_id,assigned_by,status)
         VALUES ($1,$2,$3,'assigned') ON CONFLICT (order_id) DO UPDATE SET rider_id=EXCLUDED.rider_id,assigned_by=EXCLUDED.assigned_by,assigned_at=now()
         RETURNING id,order_id,rider_id,status,assigned_at`, [req.params.id, req.body.riderId, req.admin.id],
      );
      await client.query("UPDATE orders SET status='dispatched' WHERE id=$1 AND status='preparing'", [req.params.id]);
      await recordAdminAudit(client, req.admin.id, 'assign_rider', 'order', req.params.id, { riderId: req.body.riderId });
      return assignment.rows[0];
    });
    res.json({ assignment: result });
  } catch (error) { next(error); }
});

adminRouter.get('/safety-reports', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sr.id,sr.product_id,p.name AS product_name,sr.order_id,sr.report_type,sr.details_ciphertext,sr.contact_ciphertext,sr.status,sr.resolution_note,sr.created_at,sr.updated_at
       FROM safety_reports sr LEFT JOIN products p ON p.id=sr.product_id ORDER BY sr.created_at DESC LIMIT 500`,
    );
    res.json({ reports: rows.map((report) => ({
      id: report.id, productId: report.product_id, productName: report.product_name, orderId: report.order_id, reportType: report.report_type,
      ...safeDecrypt(report.details_ciphertext), ...safeDecrypt(report.contact_ciphertext), status: report.status,
      resolutionNote: report.resolution_note, createdAt: report.created_at, updatedAt: report.updated_at,
    })) });
  } catch (error) { next(error); }
});

adminRouter.patch('/safety-reports/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const status = req.body?.status;
    if (!['new', 'in_review', 'escalated', 'resolved'].includes(status)) fail('Choose a valid safety report status.');
    const resolutionNote = text(req.body?.resolutionNote || '', 'Resolution note', 2000, false);
    const result = await transaction(async (client) => {
      const { rows } = await client.query('UPDATE safety_reports SET status=$1,resolution_note=$2,updated_at=now() WHERE id=$3 RETURNING id,status,resolution_note,updated_at', [status, resolutionNote, req.params.id]);
      if (!rows[0]) fail('Safety report not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update', 'safety_report', req.params.id, { status, resolutionNoteChanged: Boolean(resolutionNote) });
      return rows[0];
    });
    res.json({ report: result });
  } catch (error) { next(error); }
});

adminRouter.delete('/safety-reports/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const { rows } = await client.query("UPDATE safety_reports SET details_ciphertext=''::bytea,contact_ciphertext=''::bytea,status='resolved',updated_at=now() WHERE id=$1 RETURNING id", [req.params.id]);
      if (!rows[0]) fail('Safety report not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'erase_report_details', 'safety_report', req.params.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.get('/customers', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, count(o.id)::int AS order_count, max(o.created_at) AS latest_order_at
      FROM customers c LEFT JOIN orders o ON o.customer_id=c.id
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT 1000
    `);
    res.json({ customers: rows.map((customer) => ({
      id: customer.id, status: customer.status, orderCount: customer.order_count, createdAt: customer.created_at,
      latestOrderAt: customer.latest_order_at, ...safeDecrypt(customer.name_ciphertext), ...safeDecrypt(customer.phone_ciphertext),
    })) });
  } catch (error) { next(error); }
});

adminRouter.patch('/customers/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const status = req.body?.status;
    if (!['active', 'suspended'].includes(status)) fail('Choose active or suspended status.');
    const result = await transaction(async (client) => {
      const { rows } = await client.query('UPDATE customers SET status=$1,updated_at=now() WHERE id=$2 AND status <> \'deleted\' RETURNING id,status', [status, req.params.id]);
      if (!rows[0]) fail('Customer not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update_status', 'customer', req.params.id, { status });
      return rows[0];
    });
    res.json({ customer: result });
  } catch (error) { next(error); }
});

adminRouter.delete('/customers/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const activeOrders = await client.query("SELECT count(*)::int AS count FROM orders WHERE customer_id=$1 AND status NOT IN ('delivered','payment_failed','cancelled')", [req.params.id]);
      if (activeOrders.rows[0]?.count > 0) fail('Finish or resolve this customer’s active orders before erasing the profile.', 409);
      const { rows } = await client.query(
        `UPDATE customers SET status='deleted', name_ciphertext=''::bytea, phone_ciphertext=''::bytea,
          phone_lookup_hash=$1, updated_at=now() WHERE id=$2 AND status <> 'deleted' RETURNING id`,
        [crypto.randomBytes(32).toString('hex'), req.params.id],
      );
      if (!rows[0]) fail('Customer not found.', 404);
      await client.query("UPDATE orders SET customer_ciphertext=''::bytea, delivery_ciphertext=''::bytea WHERE customer_id=$1", [req.params.id]);
      await recordAdminAudit(client, req.admin.id, 'erase_profile', 'customer', req.params.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.get('/articles', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,title,slug,excerpt,body,language,status,created_by,updated_by,created_at,updated_at,published_at FROM articles ORDER BY updated_at DESC LIMIT 500');
    res.json({ articles: rows });
  } catch (error) { next(error); }
});

adminRouter.post('/articles', async (req, res, next) => {
  try {
    const title = text(req.body?.title, 'Article title', 180);
    const slug = text(req.body?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 'Slug', 180);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('Use lowercase letters, numbers, and hyphens for the slug.');
    const excerpt = text(req.body?.excerpt || '', 'Excerpt', 500, false);
    const body = text(req.body?.body || '', 'Article body', 20000, false);
    const language = req.body?.language || 'en';
    const status = req.body?.status || 'draft';
    if (!['en', 'am', 'om', 'ti'].includes(language)) fail('Choose a supported article language.');
    if (!['draft', 'published', 'archived'].includes(status)) fail('Choose a valid article status.');
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO articles (title,slug,excerpt,body,language,status,created_by,updated_by,published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,CASE WHEN $6='published' THEN now() END) RETURNING *`,
        [title, slug, excerpt, body, language, status, req.admin.id],
      );
      await recordAdminAudit(client, req.admin.id, 'create', 'article', rows[0].id, { slug, status, language });
      return rows[0];
    });
    res.status(201).json({ article: result });
  } catch (error) { next(error); }
});

adminRouter.patch('/articles/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const title = text(req.body?.title, 'Article title', 180);
    const slug = text(req.body?.slug, 'Slug', 180);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('Use lowercase letters, numbers, and hyphens for the slug.');
    const excerpt = text(req.body?.excerpt || '', 'Excerpt', 500, false);
    const body = text(req.body?.body || '', 'Article body', 20000, false);
    const language = req.body?.language || 'en';
    const status = req.body?.status || 'draft';
    if (!['en', 'am', 'om', 'ti'].includes(language) || !['draft', 'published', 'archived'].includes(status)) fail('Choose valid article language and status values.');
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE articles SET title=$1,slug=$2,excerpt=$3,body=$4,language=$5,status=$6,updated_by=$7,updated_at=now(),
          published_at=CASE WHEN $6='published' THEN COALESCE(published_at,now()) ELSE NULL END
         WHERE id=$8 RETURNING *`,
        [title, slug, excerpt, body, language, status, req.admin.id, req.params.id],
      );
      if (!rows[0]) fail('Article not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'update', 'article', req.params.id, { slug, status, language });
      return rows[0];
    });
    res.json({ article: result });
  } catch (error) { next(error); }
});

adminRouter.delete('/articles/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    await transaction(async (client) => {
      const { rows } = await client.query("UPDATE articles SET status='archived',updated_by=$1,updated_at=now(),published_at=NULL WHERE id=$2 RETURNING id", [req.admin.id, req.params.id]);
      if (!rows[0]) fail('Article not found.', 404);
      await recordAdminAudit(client, req.admin.id, 'archive', 'article', req.params.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.get('/settings', async (_req, res, next) => {
  try {
    const delivery = await deliveryConfig();
    const { rows } = await pool.query("SELECT value FROM app_settings WHERE key='site' LIMIT 1");
    const site = rows[0]?.value || { announcement: 'Skin-first beauty, made clearer', supportPhone: '' };
    res.json({ settings: { delivery, site } });
  } catch (error) { next(error); }
});

adminRouter.patch('/settings/delivery', async (req, res, next) => {
  try {
    const cities = Array.isArray(req.body?.deliveryCities) ? req.body.deliveryCities.map((city) => text(city, 'City', 80)) : [];
    if (!cities.length || cities.length > 30 || new Set(cities).size !== cities.length) fail('Add 1 to 30 unique delivery cities.');
    const suppliedFees = req.body?.deliveryFeesCents || {};
    const deliveryFeesCents = {};
    for (const city of cities) {
      const fee = Number(suppliedFees[city]);
      if (!Number.isSafeInteger(fee) || fee < 0 || fee > 100000000) fail(`Enter a valid delivery fee for ${city}.`);
      deliveryFeesCents[city] = fee;
    }
    const delivery = { deliveryCities: cities, deliveryFeesCents };
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO app_settings (key,value,updated_by,updated_at) VALUES ('delivery',$1::jsonb,$2,now())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [JSON.stringify(delivery), req.admin.id],
      );
      await recordAdminAudit(client, req.admin.id, 'update', 'site_setting', 'delivery', { cities, deliveryFeesCents });
    });
    res.json({ delivery });
  } catch (error) { next(error); }
});

adminRouter.patch('/settings/site', async (req, res, next) => {
  try {
    const site = {
      announcement: text(req.body?.announcement, 'Announcement', 180),
      supportPhone: text(req.body?.supportPhone || '', 'Support phone', 40, false),
    };
    if (site.supportPhone && !/^\+?[0-9 ()-]{8,40}$/.test(site.supportPhone)) fail('Enter a valid support phone number.');
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO app_settings (key,value,updated_by,updated_at) VALUES ('site',$1::jsonb,$2,now())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [JSON.stringify(site), req.admin.id],
      );
      await recordAdminAudit(client, req.admin.id, 'update', 'site_setting', 'site', { announcementChanged: true, supportPhoneConfigured: Boolean(site.supportPhone) });
    });
    res.json({ site });
  } catch (error) { next(error); }
});

adminRouter.get('/administrators', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,email,full_name,is_active,created_at,last_login_at FROM admin_users ORDER BY created_at');
    res.json({ administrators: rows });
  } catch (error) { next(error); }
});

adminRouter.post('/administrators', async (req, res, next) => {
  try {
    const email = text(req.body?.email, 'Email', 254).toLowerCase();
    const fullName = text(req.body?.fullName, 'Full name', 160);
    const password = req.body?.password;
    if (!EMAIL.test(email)) fail('Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 14 || password.length > 200) fail('Admin passwords must be between 14 and 200 characters.');
    const passwordHash = await hashPassword(password);
    const result = await transaction(async (client) => {
      const { rows } = await client.query('INSERT INTO admin_users (email,full_name,password_hash) VALUES ($1,$2,$3) RETURNING id,email,full_name,is_active,created_at,last_login_at', [email, fullName, passwordHash]);
      await recordAdminAudit(client, req.admin.id, 'create', 'administrator', rows[0].id);
      return rows[0];
    });
    res.status(201).json({ administrator: result });
  } catch (error) { next(error); }
});

adminRouter.patch('/administrators/:id', async (req, res, next) => {
  try {
    checkId(req.params.id);
    const isActive = req.body?.isActive;
    if (typeof isActive !== 'boolean') fail('Choose whether the administrator account is active.');
    if (!isActive && req.params.id === req.admin.id) fail('You cannot deactivate your own signed-in account.', 409);
    const result = await transaction(async (client) => {
      const { rows } = await client.query('UPDATE admin_users SET is_active=$1 WHERE id=$2 RETURNING id,email,full_name,is_active,created_at,last_login_at', [isActive, req.params.id]);
      if (!rows[0]) fail('Administrator not found.', 404);
      if (!isActive) await client.query('DELETE FROM admin_sessions WHERE admin_id=$1', [req.params.id]);
      await recordAdminAudit(client, req.admin.id, isActive ? 'activate' : 'deactivate', 'administrator', req.params.id);
      return rows[0];
    });
    res.json({ administrator: result });
  } catch (error) { next(error); }
});

adminRouter.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(250, Math.max(1, Number(req.query.limit) || 100));
    const { rows } = await pool.query(
      `SELECT e.id,e.action,e.resource_type,e.resource_id,e.details,e.created_at,a.email AS admin_email,a.full_name AS admin_name
       FROM audit_events e LEFT JOIN admin_users a ON a.id=e.admin_id ORDER BY e.created_at DESC LIMIT $1`, [limit],
    );
    res.json({ events: rows });
  } catch (error) { next(error); }
});
