import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, bearer, login, makeAdmin, pool, resetDb } from './helpers';

let admin: string, customer: string, driverTok: string, pend: string, draft: string;
beforeAll(async () => {
  await resetDb();
  await makeAdmin('root@example.com', 'correct-horse-battery');
  admin = (await request(app).post('/auth/admin/login').send({ email: 'root@example.com', password: 'correct-horse-battery' })).body.accessToken;
  customer = (await login('9600000001', 'CUSTOMER')).accessToken;
  const d1 = await login('9600000002', 'DRIVER'); driverTok = d1.accessToken; pend = d1.user.id;
  await pool.query(`UPDATE drivers SET status='PENDING_VERIFICATION', full_name='Pending One', address='Sector 1' WHERE user_id=$1`, [pend]);
  draft = (await login('9600000003', 'DRIVER')).user.id;
});
afterAll(() => pool.end());

describe('dashboard stats', () => {
  it('returns real counts', async () => {
    const r = await request(app).get('/admin/stats').set(bearer(admin));
    expect(r.status).toBe(200);
    expect(r.body.stats).toMatchObject({ totalCustomers: 1, totalDrivers: 2, pendingDrivers: 1, verifiedDrivers: 0, activeRides: 0, revenue: 0 });
  });
  it('is closed to customers and drivers', async () => {
    expect((await request(app).get('/admin/stats').set(bearer(customer))).status).toBe(403);
    expect((await request(app).get('/admin/stats').set(bearer(driverTok))).status).toBe(403);
  });
});

describe('driver verification decisions', () => {
  it('rejects without a reason', async () => {
    expect((await request(app).put(`/admin/drivers/${pend}/reject`).set(bearer(admin)).send({})).status).toBe(400);
  });
  it('will not approve a driver who has not finished their profile', async () => {
    await pool.query(`UPDATE drivers SET status='PENDING_VERIFICATION' WHERE user_id=$1`, [draft]);
    const r = await request(app).put(`/admin/drivers/${draft}/approve`).set(bearer(admin));
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PROFILE_INCOMPLETE');
  });
  it('will not move a draft driver straight to verified', async () => {
    await pool.query(`UPDATE drivers SET status='DRAFT' WHERE user_id=$1`, [draft]);
    const r = await request(app).put(`/admin/drivers/${draft}/approve`).set(bearer(admin));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INVALID_TRANSITION');
  });
  it('approves, notifies the driver, and writes an audit log', async () => {
    const r = await request(app).put(`/admin/drivers/${pend}/approve`).set(bearer(admin));
    expect(r.status).toBe(200);
    expect(r.body.driver.status).toBe('VERIFIED');
    const n = await pool.query(`SELECT title FROM notifications WHERE user_id=$1`, [pend]);
    expect(n.rows[0].title).toBe('You are approved');
    expect((await pool.query(`SELECT 1 FROM audit_logs WHERE action='driver.approve' AND entity_id=$1`, [pend])).rowCount).toBe(1);
    const on = await request(app).post('/drivers/online').set(bearer(driverTok)).send({ online: true });
    expect(on.status).toBe(200);
  });
  it('suspends a verified driver and forces them offline', async () => {
    const r = await request(app).put(`/admin/drivers/${pend}/suspend`).set(bearer(admin)).send({ reason: 'Complaint under review' });
    expect(r.status).toBe(200);
    const d = (await pool.query('SELECT status, is_online FROM drivers WHERE user_id=$1', [pend])).rows[0];
    expect(d).toEqual({ status: 'SUSPENDED', is_online: false });
    expect((await request(app).post('/drivers/online').set(bearer(driverTok)).send({ online: true })).status).toBe(403);
  });
  it('can reinstate a suspended driver', async () => {
    expect((await request(app).put(`/admin/drivers/${pend}/approve`).set(bearer(admin))).status).toBe(200);
  });
  it('rejects a pending driver with the reason shown to them', async () => {
    await pool.query(`UPDATE drivers SET status='PENDING_VERIFICATION', full_name='Draft Two', address='Sector 9' WHERE user_id=$1`, [draft]);
    expect((await request(app).put(`/admin/drivers/${draft}/reject`).set(bearer(admin)).send({ reason: 'Licence photo is unreadable' })).status).toBe(200);
    const st = await request(app).get('/drivers/verification-status').set(bearer((await login('9600000003', 'DRIVER')).accessToken));
    expect(st.body).toMatchObject({ status: 'REJECTED', reason: 'Licence photo is unreadable' });
  });
  it('blocks customers and drivers from deciding', async () => {
    expect((await request(app).put(`/admin/drivers/${pend}/approve`).set(bearer(customer))).status).toBe(403);
    expect((await request(app).put(`/admin/drivers/${pend}/approve`).set(bearer(driverTok))).status).toBe(403);
  });
  it('returns 404 for an unknown driver and 400 for a bad id', async () => {
    expect((await request(app).put('/admin/drivers/00000000-0000-4000-8000-000000000000/approve').set(bearer(admin))).status).toBe(404);
    expect((await request(app).put('/admin/drivers/abc/approve').set(bearer(admin))).status).toBe(400);
  });
});

describe('pricing', () => {
  it('shows the starting price of 10 per km', async () => {
    const r = await request(app).get('/admin/pricing').set(bearer(admin));
    expect(r.body.pricing.minimumPricePerKm).toBe(10);
    expect(r.body.pricing.maximumFare).toBeNull();
  });
  it('changes the per-km rate without touching other settings, keeping history', async () => {
    const before = (await request(app).get('/admin/pricing').set(bearer(admin))).body.pricing;
    const r = await request(app).put('/admin/pricing').set(bearer(admin)).send({ minimumPricePerKm: 11 });
    expect(r.status).toBe(200);
    expect(r.body.pricing.minimumPricePerKm).toBe(11);
    expect(r.body.pricing.platformFee).toBe(before.platformFee);
    expect(r.body.changes).toEqual({ minimumPricePerKm: { from: 10, to: 11 } });
    const active = await pool.query('SELECT count(*)::int AS n FROM pricing_settings WHERE is_active');
    expect(active.rows[0].n).toBe(1);
    const h = (await request(app).get('/admin/pricing/history').set(bearer(admin))).body.history;
    expect(h.length).toBe(2);
    expect(h[0].isActive).toBe(true);
    expect(h[0].changedBy).toBe('root@example.com');
    expect(h[1].minimumPricePerKm).toBe(10);
    expect((await pool.query(`SELECT 1 FROM audit_logs WHERE action='pricing.update'`)).rowCount).toBe(1);
  });
  it('rejects bad values, unknown fields, empty and unchanged requests', async () => {
    for (const body of [{ minimumPricePerKm: 0 }, { minimumPricePerKm: -5 }, { minimumPricePerKm: 'ten' }, { driverCommissionPct: 120 }, { hack: 1 }, {}]) {
      expect((await request(app).put('/admin/pricing').set(bearer(admin)).send(body)).status, JSON.stringify(body)).toBe(400);
    }
    const same = await request(app).put('/admin/pricing').set(bearer(admin)).send({ minimumPricePerKm: 11 });
    expect(same.status).toBe(400);
    expect(same.body.error.code).toBe('NO_CHANGE');
  });
  it('rejects match scores that are out of order', async () => {
    const r = await request(app).put('/admin/pricing').set(bearer(admin)).send({ matchExcellentScore: 60 });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_PRICING');
    expect((await request(app).get('/admin/pricing').set(bearer(admin))).body.pricing.matchExcellentScore).toBe(85);
  });
  it('is closed to non-admins', async () => {
    expect((await request(app).put('/admin/pricing').set(bearer(customer)).send({ minimumPricePerKm: 1 })).status).toBe(403);
    expect((await request(app).get('/admin/pricing').set(bearer(driverTok))).status).toBe(403);
  });
});
