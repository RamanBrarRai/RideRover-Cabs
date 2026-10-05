import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { query } from './db/pool';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './auth/auth.routes';
import { customersRouter } from './customers/customers.routes';
import { driversRouter } from './drivers/drivers.routes';
import { adminRouter } from './admin/admin.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : false }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    try { await query('SELECT 1'); res.json({ ok: true }); }
    catch { res.status(503).json({ ok: false, error: 'database unreachable' }); }
  });

  app.use('/auth', authRouter);
  app.use('/customers', customersRouter);
  app.use('/drivers', driversRouter);
  app.use('/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
