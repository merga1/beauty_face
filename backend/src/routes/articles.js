import { Router } from 'express';
import { pool } from '../db.js';

export const articlesRouter = Router();

articlesRouter.get('/', async (req, res, next) => {
  try {
    const language = typeof req.query.language === 'string' ? req.query.language : '';
    const values = [];
    let where = "status='published'";
    if (['en', 'am', 'om', 'ti'].includes(language)) {
      values.push(language);
      where += ` AND language=$${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT id,title,slug,excerpt,body,language,published_at FROM articles WHERE ${where} ORDER BY published_at DESC LIMIT 30`, values,
    );
    res.json({ articles: rows });
  } catch (error) { next(error); }
});
