import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { query } from '../db/pool';
import { conflict } from '../utils/errors';

export const customersRouter = Router();
customersRouter.use(authenticate, requireRole('CUSTOMER'));

const select = `SELECT u.id, u.phone, u.email, c.full_name AS "fullName", c.kyc_status AS "kycStatus",
                       c.rating_avg AS "ratingAvg", c.rating_count AS "ratingCount"
                  FROM users u JOIN customers c ON c.user_id=u.id WHERE u.id=$1`;

customersRouter.get('/profile', async (req, res, next) => {
  try { res.json({ profile: (await query(select, [req.user!.id])).rows[0] }); } catch (e) { next(e); }
});

customersRouter.put('/profile', async (req, res, next) => {
  try {
    const b = z.object({ fullName: z.string().trim().min(2).max(80), email: z.string().email().max(120).optional() }).parse(req.body);
    await query('UPDATE customers SET full_name=$2 WHERE user_id=$1', [req.user!.id, b.fullName]);
    if (b.email) {
      try { await query('UPDATE users SET email=$2 WHERE id=$1', [req.user!.id, b.email.toLowerCase()]); }
      catch (e: any) { if (e.code === '23505') throw conflict('That email is already used by another account.', 'EMAIL_TAKEN'); throw e; }
    }
    res.json({ profile: (await query(select, [req.user!.id])).rows[0] });
  } catch (e) { next(e); }
});
