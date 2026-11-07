import { Router } from 'express';
import { pool } from '../db.js';

export const productsRouter = Router();

const productFields = `id, slug, name, brand, category, description, price_cents,
  skin_types, concerns, ingredients, how_to_use, warnings, supplier_verification,
  expiry_information, sample_listing, stock_count`;

productsRouter.get('/', async (req, res, next) => {
  try {
    const { q = '', category = '', skinType = '', concern = '' } = req.query;
    const values = [];
    const where = ['published = true'];
    if (q) {
      values.push(`%${String(q).slice(0, 100)}%`);
      where.push(`(name ILIKE $${values.length} OR brand ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }
    if (category) {
      values.push(String(category).slice(0, 60));
      where.push(`category = $${values.length}`);
    }
    if (skinType) {
      values.push(String(skinType).slice(0, 40));
      where.push(`($${values.length} = ANY(skin_types) OR 'all' = ANY(skin_types))`);
    }
    if (concern) {
      values.push(String(concern).slice(0, 60));
      where.push(`$${values.length} = ANY(concerns)`);
    }
    const { rows } = await pool.query(
      `SELECT ${productFields} FROM products WHERE ${where.join(' AND ')} ORDER BY name LIMIT 100`,
      values,
    );
    res.json({ products: rows });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${productFields} FROM products WHERE slug = $1 AND published = true LIMIT 1`,
      [req.params.slug],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch (error) {
    next(error);
  }
});
