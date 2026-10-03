import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { query } from '../db/pool';

export const driversRouter = Router();
driversRouter.use(authenticate, requireRole('DRIVER'));

const select = `SELECT u.id, u.phone, d.full_name AS "fullName", d.address, d.status, d.status_reason AS "statusReason",
                       d.is_online AS "isOnline", d.rating_avg AS "ratingAvg", d.rating_count AS "ratingCount"
                  FROM users u JOIN drivers d ON d.user_id=u.id WHERE u.id=$1`;

driversRouter.get('/profile', async (req, res, next) => {
  try { res.json({ profile: (await query(select, [req.user!.id])).rows[0] }); } catch (e) { next(e); }
});

driversRouter.put('/profile', async (req, res, next) => {
  try {
    const b = z.object({ fullName: z.string().trim().min(2).max(80), address: z.string().trim().min(5).max(250) }).parse(req.body);
    await query('UPDATE drivers SET full_name=$2, address=$3 WHERE user_id=$1', [req.user!.id, b.fullName, b.address]);
    res.json({ profile: (await query(select, [req.user!.id])).rows[0] });
  } catch (e) { next(e); }
});

driversRouter.get('/verification-status', async (req, res, next) => {
  try {
    const d = (await query('SELECT status, status_reason AS "reason" FROM drivers WHERE user_id=$1', [req.user!.id])).rows[0];
    const docs = (await query(
      `SELECT doc_type AS "type", status, review_note AS "note", created_at AS "uploadedAt"
         FROM driver_documents WHERE driver_id=$1 ORDER BY created_at DESC`, [req.user!.id])).rows;
    res.json({ status: d.status, reason: d.reason, documents: docs });
  } catch (e) { next(e); }
});
