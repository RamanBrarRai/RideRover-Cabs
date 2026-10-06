import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { query } from '../db/pool';
import { forbidden } from '../utils/errors';

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
    const d = (await query('SELECT status, status_reason AS "reason", (full_name IS NOT NULL AND address IS NOT NULL) AS "profileComplete" FROM drivers WHERE user_id=$1', [req.user!.id])).rows[0];
    const docs = (await query(
      `SELECT doc_type AS "type", status, review_note AS "note", created_at AS "uploadedAt"
         FROM driver_documents WHERE driver_id=$1
       UNION ALL
       SELECT vd.doc_type, vd.status, vd.review_note, vd.created_at
         FROM vehicle_documents vd JOIN vehicles v ON v.id=vd.vehicle_id WHERE v.driver_id=$1
       ORDER BY "uploadedAt" DESC`, [req.user!.id])).rows;
    res.json({ status: d.status, reason: d.reason, profileComplete: d.profileComplete, documents: docs });
  } catch (e) { next(e); }
});

/** Go online / offline. Only VERIFIED drivers can go online (the database enforces this too). */
driversRouter.post('/online', async (req, res, next) => {
  try {
    const { online } = z.object({ online: z.boolean() }).parse(req.body);
    const d = (await query('SELECT status FROM drivers WHERE user_id=$1', [req.user!.id])).rows[0];
    if (online && d.status !== 'VERIFIED') throw forbidden('Only verified drivers can go online.', 'DRIVER_NOT_VERIFIED');
    await query('UPDATE drivers SET is_online=$2, last_seen_at=now() WHERE user_id=$1', [req.user!.id, online]);
    res.json({ isOnline: online });
  } catch (e) { next(e); }
});

/** Today / this week / this month earnings (India time) plus rating. */
driversRouter.get('/summary', async (req, res, next) => {
  try {
    const e = (await query(
      `WITH n AS (SELECT now() AT TIME ZONE 'Asia/Kolkata' AS t),
            e AS (SELECT net_amount, gross_amount, commission, created_at AT TIME ZONE 'Asia/Kolkata' AS t FROM driver_earnings WHERE driver_id=$1)
       SELECT
         COALESCE(SUM(e.net_amount) FILTER (WHERE e.t::date = n.t::date),0)::float8 AS "todayEarnings",
         COUNT(e.t) FILTER (WHERE e.t::date = n.t::date)::int AS "todayTrips",
         COALESCE(SUM(e.net_amount) FILTER (WHERE date_trunc('week', e.t) = date_trunc('week', n.t)),0)::float8 AS "weekEarnings",
         COUNT(e.t) FILTER (WHERE date_trunc('week', e.t) = date_trunc('week', n.t))::int AS "weekTrips",
         COALESCE(SUM(e.net_amount) FILTER (WHERE date_trunc('month', e.t) = date_trunc('month', n.t)),0)::float8 AS "monthEarnings",
         COUNT(e.t) FILTER (WHERE date_trunc('month', e.t) = date_trunc('month', n.t))::int AS "monthTrips",
         COALESCE(SUM(e.gross_amount),0)::float8 AS "totalGross",
         COALESCE(SUM(e.commission),0)::float8 AS "totalCommission",
         COALESCE(SUM(e.net_amount),0)::float8 AS "totalNet"
       FROM n LEFT JOIN e ON true`, [req.user!.id])).rows[0];
    const d = (await query('SELECT rating_avg::float8 AS "ratingAvg", rating_count AS "ratingCount", is_online AS "isOnline" FROM drivers WHERE user_id=$1', [req.user!.id])).rows[0];
    res.json({ ...e, ...d });
  } catch (e) { next(e); }
});
