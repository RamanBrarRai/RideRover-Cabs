import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, bearer, login, pool, resetDb } from './helpers';

let tok: string, id: string, vtok: string, vid: string;
beforeAll(async () => {
  await resetDb();
  const d = await login('9700000001', 'DRIVER'); tok = d.accessToken; id = d.user.id;
  const v = await login('9700000002', 'DRIVER'); vtok = v.accessToken; vid = v.user.id;
  await pool.query(`UPDATE drivers SET status='VERIFIED', full_name='Verified Driver', address='Mohali' WHERE user_id=$1`, [vid]);
});
afterAll(() => pool.end());

describe('driver online switch', () => {
  it('stops an unverified driver going online', async () => {
    const r = await request(app).post('/drivers/online').set(bearer(tok)).send({ online: true });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('DRIVER_NOT_VERIFIED');
  });
  it('lets an unverified driver stay offline', async () => {
    expect((await request(app).post('/drivers/online').set(bearer(tok)).send({ online: false })).status).toBe(200);
  });
  it('lets a verified driver go online and offline', async () => {
    const on = await request(app).post('/drivers/online').set(bearer(vtok)).send({ online: true });
    expect(on.body.isOnline).toBe(true);
    expect((await request(app).get('/drivers/profile').set(bearer(vtok))).body.profile.isOnline).toBe(true);
    const off = await request(app).post('/drivers/online').set(bearer(vtok)).send({ online: false });
    expect(off.body.isOnline).toBe(false);
  });
  it('rejects a bad body and a customer caller', async () => {
    expect((await request(app).post('/drivers/online').set(bearer(vtok)).send({ online: 'yes' })).status).toBe(400);
    const c = await login('9700000003', 'CUSTOMER');
    expect((await request(app).post('/drivers/online').set(bearer(c.accessToken)).send({ online: true })).status).toBe(403);
  });
});

describe('driver summary', () => {
  it('is all zeros for a new driver', async () => {
    const r = await request(app).get('/drivers/summary').set(bearer(vtok));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ todayEarnings: 0, todayTrips: 0, weekEarnings: 0, monthEarnings: 0, totalNet: 0, ratingCount: 0 });
  });
  it('adds up earnings for today, this week and this month', async () => {
    const cust = (await login('9700000004', 'CUSTOMER')).user.id;
    const loc = (await pool.query(`INSERT INTO locations(label,lat,lng) VALUES ('A',30.7,76.7),('B',28.6,77.2) RETURNING id`)).rows;
    const pr = (await pool.query('SELECT id FROM pricing_settings WHERE is_active')).rows[0].id;
    const mk = async () => (await pool.query(
      `INSERT INTO rides(customer_id,driver_id,pickup_id,drop_id,scheduled_at,status,distance_km,duration_min,fare_total,fare_breakdown,pricing_id)
       VALUES ($1,$2,$3,$4,now(),'TRIP_COMPLETED',250,300,2500,'{}',$5) RETURNING id`, [cust, vid, loc[0].id, loc[1].id, pr])).rows[0].id;
    const b = async (rideId: string, key: string) => (await pool.query(
      `INSERT INTO bookings(customer_id,booking_type,ride_id,fare_total,idempotency_key,status) VALUES ($1,'PERSONAL',$2,2500,$3,'TRIP_COMPLETED') RETURNING id`, [cust, rideId, key])).rows[0].id;
    const b1 = await b(await mk(), 'k1'), b2 = await b(await mk(), 'k2');
    await pool.query(`INSERT INTO driver_earnings(driver_id,booking_id,gross_amount,commission,net_amount) VALUES ($1,$2,2500,375,2125)`, [vid, b1]);
    await pool.query(`INSERT INTO driver_earnings(driver_id,booking_id,gross_amount,commission,net_amount,created_at) VALUES ($1,$2,1000,150,850, now() - interval '40 days')`, [vid, b2]);
    const r = (await request(app).get('/drivers/summary').set(bearer(vtok))).body;
    expect(r.todayEarnings).toBe(2125);
    expect(r.todayTrips).toBe(1);
    expect(r.monthEarnings).toBe(2125);
    expect(r.totalNet).toBe(2975);
    expect(r.totalCommission).toBe(525);
  });
});

describe('verification status', () => {
  it('reports profile completeness and documents (driver and vehicle)', async () => {
    const before = (await request(app).get('/drivers/verification-status').set(bearer(tok))).body;
    expect(before).toMatchObject({ status: 'DRAFT', profileComplete: false, documents: [] });
    await pool.query(`UPDATE drivers SET full_name='X Driver', address='Phase 7 Mohali' WHERE user_id=$1`, [id]);
    await pool.query(`INSERT INTO driver_documents(driver_id,doc_type,storage_key,mime_type) VALUES ($1,'LICENCE','k/1','image/jpeg')`, [id]);
    const veh = (await pool.query(`INSERT INTO vehicles(driver_id,category,make_model,reg_number,seats_total) VALUES ($1,'SEDAN','Dzire','PB10TEST0001',4) RETURNING id`, [id])).rows[0].id;
    await pool.query(`INSERT INTO vehicle_documents(vehicle_id,doc_type,storage_key,mime_type) VALUES ($1,'INSURANCE','k/2','application/pdf')`, [veh]);
    const after = (await request(app).get('/drivers/verification-status').set(bearer(tok))).body;
    expect(after.profileComplete).toBe(true);
    expect(after.documents.map((d: any) => d.type).sort()).toEqual(['INSURANCE', 'LICENCE']);
  });
});
