import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pool } from './db.js';
import { publicConfig } from './config.js';
import { productsRouter } from './routes/products.js';
import { consultationsRouter } from './routes/consultations.js';
import { ordersRouter } from './routes/orders.js';
import { webhooksRouter } from './routes/webhooks.js';
import { adminRouter } from './routes/admin.js';
import { articlesRouter } from './routes/articles.js';
import { safetyReportsRouter } from './routes/safety-reports.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const origins = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'] }));
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '64kb' }), webhooksRouter);
app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/admin/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/admin', adminRouter);
app.use('/api/consultation-requests', rateLimit({ windowMs: 60 * 60_000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/orders', rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/safety-reports', rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});
app.get('/api/config/public', async (_req, res, next) => {
  try { res.json(await publicConfig()); } catch (error) { next(error); }
});
app.use('/api/products', productsRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/safety-reports', safetyReportsRouter);
app.use('/api/consultation-requests', consultationsRouter);
app.use('/api/orders', ordersRouter);
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, _req, res, _next) => {
  const status = Number(error.status) || (error.code === '23505' ? 409 : 500);
  if (status >= 500) console.error('Request failed:', error.message);
  res.status(status).json({ error: status >= 500 ? 'The request could not be completed.' : error.message });
});

const server = app.listen(port, () => console.log(`Beauty Face API listening on ${port}`));
const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
