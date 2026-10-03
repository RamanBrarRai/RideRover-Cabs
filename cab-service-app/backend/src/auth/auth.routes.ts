import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import { authenticate } from '../middleware/auth';
import { query } from '../db/pool';
import * as svc from './auth.service';

const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const role = z.enum(['CUSTOMER', 'DRIVER']);

// Per-IP brake on top of the per-phone limits inside the service.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: env.NODE_ENV === 'test' ? 10_000 : 30, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } },
});

export const authRouter = Router();
authRouter.use(limiter);

authRouter.post('/send-otp', async (req, res, next) => {
  try {
    const { phone: p } = z.object({ phone, role }).parse(req.body);
    res.json(await svc.sendOtp(p));
  } catch (e) { next(e); }
});

authRouter.post('/verify-otp', async (req, res, next) => {
  try {
    const b = z.object({ phone, role, otp: z.string().regex(/^\d{6}$/, 'The code is 6 digits') }).parse(req.body);
    res.json(await svc.verifyOtp(b.phone, b.otp, b.role));
  } catch (e) { next(e); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    res.json(await svc.refresh(refreshToken));
  } catch (e) { next(e); }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    await svc.logout(refreshToken);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

authRouter.post('/admin/login', async (req, res, next) => {
  try {
    const b = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    res.json(await svc.adminLogin(b.email, b.password));
  } catch (e) { next(e); }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, role, phone, email, status, created_at FROM users WHERE id=$1', [req.user!.id]);
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});
