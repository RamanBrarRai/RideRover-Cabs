import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { query } from '../db/pool';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));

const page = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0) });

adminRouter.get('/customers', async (req, res, next) => {
  try {
    const { limit, offset } = page.parse(req.query);
    const { rows } = await query(
      `SELECT u.id, u.phone, u.status, c.full_name AS "fullName", c.kyc_status AS "kycStatus", u.created_at AS "createdAt"
         FROM users u JOIN customers c ON c.user_id=u.id WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ customers: rows });
  } catch (e) { next(e); }
});

adminRouter.get('/drivers', async (req, res, next) => {
  try {
    const q = page.extend({ status: z.enum(['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED']).optional() }).parse(req.query);
    const { rows } = await query(
      `SELECT u.id, u.phone, u.status AS "accountStatus", d.full_name AS "fullName", d.status, d.is_online AS "isOnline", u.created_at AS "createdAt"
         FROM users u JOIN drivers d ON d.user_id=u.id
        WHERE u.deleted_at IS NULL AND ($3::driver_status IS NULL OR d.status=$3::driver_status)
        ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [q.limit, q.offset, q.status ?? null]);
    res.json({ drivers: rows });
  } catch (e) { next(e); }
});
