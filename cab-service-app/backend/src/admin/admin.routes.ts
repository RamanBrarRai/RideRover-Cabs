import { Request, Response, NextFunction, Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { query, tx } from '../db/pool';
import { badRequest, conflict, notFound } from '../utils/errors';
import { audit } from '../utils/audit';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));

const page = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0) });
const idParam = z.object({ id: z.string().uuid() });

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT count(*) FROM customers c JOIN users u ON u.id=c.user_id WHERE u.deleted_at IS NULL)::int AS "totalCustomers",
        (SELECT count(DISTINCT customer_id) FROM bookings WHERE created_at > now() - interval '30 days')::int AS "activeCustomers",
        (SELECT count(*) FROM drivers d JOIN users u ON u.id=d.user_id WHERE u.deleted_at IS NULL)::int AS "totalDrivers",
        (SELECT count(*) FROM drivers WHERE status='VERIFIED')::int AS "verifiedDrivers",
        (SELECT count(*) FROM drivers WHERE status='PENDING_VERIFICATION')::int AS "pendingDrivers",
        (SELECT count(*) FROM rides WHERE status IN ('ACCEPTED','DRIVER_EN_ROUTE','ARRIVED','TRIP_STARTED'))::int AS "activeRides",
        (SELECT count(*) FROM rides WHERE status='TRIP_COMPLETED')::int AS "completedRides",
        (SELECT count(*) FROM rides WHERE status='CANCELLED')::int AS "cancelledRides",
        (SELECT count(*) FROM shared_rides)::int AS "sharedRides",
        (SELECT COALESCE(SUM(amount - refunded_amount),0) FROM payments WHERE status IN ('SUCCESS','PARTIALLY_REFUNDED'))::float8 AS "revenue",
        (SELECT COALESCE(SUM(net_amount),0) FROM driver_earnings)::float8 AS "driverEarnings",
        (SELECT COALESCE(SUM(commission),0) FROM driver_earnings)::float8 AS "platformCommission"`);
    res.json({ stats: rows[0] });
  } catch (e) { next(e); }
});

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
      `SELECT u.id, u.phone, u.status AS "accountStatus", d.full_name AS "fullName", d.address, d.status, d.status_reason AS "statusReason",
              d.is_online AS "isOnline", u.created_at AS "createdAt"
         FROM users u JOIN drivers d ON d.user_id=u.id
        WHERE u.deleted_at IS NULL AND ($3::driver_status IS NULL OR d.status=$3::driver_status)
        ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [q.limit, q.offset, q.status ?? null]);
    res.json({ drivers: rows });
  } catch (e) { next(e); }
});

// ---- Driver verification decisions ----
type DriverStatus = 'DRAFT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
function decision(to: DriverStatus, from: DriverStatus[], action: string, needReason: boolean, note: (r?: string) => [string, string]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParam.parse(req.params);
      const body = z.object({ reason: needReason ? z.string().trim().min(5).max(300) : z.string().trim().max(300).optional() }).parse(req.body ?? {});
      const out = await tx(async (c) => {
        const d = (await c.query('SELECT status, full_name, address FROM drivers WHERE user_id=$1 FOR UPDATE', [id])).rows[0];
        if (!d) throw notFound('Driver not found.');
        if (!from.includes(d.status)) throw conflict(`A driver who is ${String(d.status).toLowerCase().replace('_', ' ')} cannot be moved to ${to.toLowerCase().replace('_', ' ')}.`, 'INVALID_TRANSITION');
        if (to === 'VERIFIED' && !(d.full_name && d.address)) throw badRequest('The driver has not completed their profile yet.', 'PROFILE_INCOMPLETE');
        await c.query('UPDATE drivers SET status=$2, status_reason=$3, is_online = CASE WHEN $2::driver_status = \'VERIFIED\' THEN is_online ELSE false END WHERE user_id=$1', [id, to, body.reason ?? null]);
        const [title, text] = note(body.reason);
        await c.query(`INSERT INTO notifications(user_id, kind, title, body) VALUES ($1,$2,$3,$4)`, [id, `driver.${to.toLowerCase()}`, title, text]);
        return { id, from: d.status as string, status: to };
      });
      await audit(req, action, 'driver', id, { from: out.from, to, reason: body.reason });
      res.json({ driver: out });
    } catch (e) { next(e); }
  };
}
adminRouter.put('/drivers/:id/approve', decision('VERIFIED', ['PENDING_VERIFICATION', 'SUSPENDED'], 'driver.approve', false, () => ['You are approved', 'Your documents are verified. You can go online and receive rides.']));
adminRouter.put('/drivers/:id/reject', decision('REJECTED', ['PENDING_VERIFICATION'], 'driver.reject', true, (r) => ['Verification not approved', `Reason: ${r}`]));
adminRouter.put('/drivers/:id/suspend', decision('SUSPENDED', ['VERIFIED', 'PENDING_VERIFICATION'], 'driver.suspend', true, (r) => ['Account suspended', `Reason: ${r}`]));

// ---- Pricing (admin-editable; every change is a new row, so history is kept) ----
const COLS = {
  minimumPricePerKm: 'minimum_price_per_km', baseFare: 'base_fare', perMinuteFare: 'per_minute_fare', minimumFare: 'minimum_fare',
  maximumFare: 'maximum_fare', platformFee: 'platform_fee', driverCommissionPct: 'driver_commission_pct', waitingFeePerHour: 'waiting_fee_per_hour',
  cancellationFee: 'cancellation_fee', tollPer100km: 'toll_per_100km', suvMultiplier: 'suv_multiplier', sharedSeatFactor: 'shared_seat_factor',
  minSeatFare: 'min_seat_fare', matchExcellentScore: 'match_excellent_score', matchGoodScore: 'match_good_score', matchMinScore: 'match_min_score',
  matchRadiusKm: 'match_radius_km', matchTimeWindowMin: 'match_time_window_min',
} as const;
type Key = keyof typeof COLS;
const keys = Object.keys(COLS) as Key[];

const pricingBody = z.object({
  minimumPricePerKm: z.number().positive().max(1000), baseFare: z.number().min(0).max(1_000_000), perMinuteFare: z.number().min(0).max(1000),
  minimumFare: z.number().min(0).max(1_000_000), maximumFare: z.number().positive().max(10_000_000).nullable(), platformFee: z.number().min(0).max(100_000),
  driverCommissionPct: z.number().min(0).max(100), waitingFeePerHour: z.number().min(0).max(100_000), cancellationFee: z.number().min(0).max(100_000),
  tollPer100km: z.number().min(0).max(100_000), suvMultiplier: z.number().min(1).max(10), sharedSeatFactor: z.number().gt(0).max(1),
  minSeatFare: z.number().min(0).max(100_000), matchExcellentScore: z.number().int().min(1).max(100), matchGoodScore: z.number().int().min(1).max(100),
  matchMinScore: z.number().int().min(1).max(100), matchRadiusKm: z.number().gt(0).max(500), matchTimeWindowMin: z.number().int().gt(0).max(1440),
}).partial().strict();

function toCamel(row: any) {
  const out: Record<string, unknown> = { id: row.id, createdAt: row.created_at };
  for (const k of keys) out[k] = row[COLS[k]] === null ? null : Number(row[COLS[k]]);
  return out;
}

adminRouter.get('/pricing', async (_req, res, next) => {
  try { res.json({ pricing: toCamel((await query('SELECT * FROM pricing_settings WHERE is_active')).rows[0]) }); } catch (e) { next(e); }
});

adminRouter.get('/pricing/history', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.email AS changed_by FROM pricing_settings p LEFT JOIN users u ON u.id=p.created_by ORDER BY p.created_at DESC LIMIT 50`);
    res.json({ history: rows.map((r) => ({ ...toCamel(r), isActive: r.is_active, changedBy: r.changed_by })) });
  } catch (e) { next(e); }
});

adminRouter.put('/pricing', async (req, res, next) => {
  try {
    const patch = pricingBody.parse(req.body);
    if (!Object.keys(patch).length) throw badRequest('Send at least one price setting to change.');
    const result = await tx(async (c) => {
      const cur = (await c.query('SELECT * FROM pricing_settings WHERE is_active FOR UPDATE')).rows[0];
      const next: Record<string, unknown> = {};
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const k of keys) {
        const v = k in patch ? (patch as any)[k] : (cur[COLS[k]] === null ? null : Number(cur[COLS[k]]));
        next[COLS[k]] = v;
        const before = cur[COLS[k]] === null ? null : Number(cur[COLS[k]]);
        if (v !== before) changes[k] = { from: before, to: v };
      }
      if (!Object.keys(changes).length) throw badRequest('Nothing changed.', 'NO_CHANGE');
      await c.query('UPDATE pricing_settings SET is_active=false WHERE is_active');
      const cols = keys.map((k) => COLS[k]);
      const ins = await c.query(
        `INSERT INTO pricing_settings(is_active, created_by, ${cols.join(',')}) VALUES (true, $1, ${cols.map((_, i) => `$${i + 2}`).join(',')}) RETURNING *`,
        [req.user!.id, ...cols.map((col) => next[col])]);
      return { row: ins.rows[0], changes };
    }).catch((e: any) => { if (e.code === '23514') throw badRequest('Those values are not allowed together (for example the match scores must go excellent, good, then minimum).', 'INVALID_PRICING'); throw e; });
    await audit(req, 'pricing.update', 'pricing_settings', result.row.id, result.changes);
    res.json({ pricing: toCamel(result.row), changes: result.changes });
  } catch (e) { next(e); }
});
