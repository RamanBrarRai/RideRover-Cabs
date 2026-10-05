import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, bearer, login, makeAdmin, pool, resetDb } from './helpers';

let customer: string, driver: string, admin: string, customerId: string;

beforeAll(async () => {
  await resetDb();
  const c = await login('9900000001', 'CUSTOMER'); customer = c.accessToken; customerId = c.user.id;
  driver = (await login('9900000002', 'DRIVER')).accessToken;
  await makeAdmin('root@example.com', 'correct-horse-battery');
  admin = (await request(app).post('/auth/admin/login').send({ email: 'root@example.com', password: 'correct-horse-battery' })).body.accessToken;
});
afterAll(() => pool.end());

describe('who can open what', () => {
  it('requires a token on every protected route', async () => {
    for (const path of ['/customers/profile', '/drivers/profile', '/admin/customers', '/admin/drivers', '/auth/me']) {
      const r = await request(app).get(path);
      expect(r.status, path).toBe(401);
    }
  });
  it('rejects a garbage token', async () => {
    expect((await request(app).get('/customers/profile').set(bearer('not.a.token'))).status).toBe(401);
  });
  it('rejects an expired token', async () => {
    const t = jwt.sign({ role: 'CUSTOMER' }, process.env.JWT_SECRET!, { subject: customerId, expiresIn: -10 });
    expect((await request(app).get('/customers/profile').set(bearer(t))).status).toBe(401);
  });
  it('lets a customer use customer routes only', async () => {
    expect((await request(app).get('/customers/profile').set(bearer(customer))).status).toBe(200);
    expect((await request(app).get('/drivers/profile').set(bearer(customer))).status).toBe(403);
    expect((await request(app).get('/admin/customers').set(bearer(customer))).status).toBe(403);
    expect((await request(app).get('/admin/drivers').set(bearer(customer))).status).toBe(403);
  });
  it('lets a driver use driver routes only', async () => {
    expect((await request(app).get('/drivers/profile').set(bearer(driver))).status).toBe(200);
    expect((await request(app).get('/customers/profile').set(bearer(driver))).status).toBe(403);
    expect((await request(app).get('/admin/customers').set(bearer(driver))).status).toBe(403);
    expect((await request(app).get('/admin/drivers').set(bearer(driver))).status).toBe(403);
  });
  it('lets an admin use admin routes, but not customer or driver routes', async () => {
    const c = await request(app).get('/admin/customers').set(bearer(admin));
    expect(c.status).toBe(200);
    expect(c.body.customers.length).toBeGreaterThan(0);
    const d = await request(app).get('/admin/drivers?status=DRAFT').set(bearer(admin));
    expect(d.status).toBe(200);
    expect(d.body.drivers[0].status).toBe('DRAFT');
    expect((await request(app).get('/customers/profile').set(bearer(admin))).status).toBe(403);
    expect((await request(app).get('/drivers/profile').set(bearer(admin))).status).toBe(403);
  });
  it('ignores a role claim forged inside a token (the role is read from the database)', async () => {
    const forged = jwt.sign({ role: 'ADMIN' }, process.env.JWT_SECRET!, { subject: customerId, expiresIn: '5m' });
    expect((await request(app).get('/admin/customers').set(bearer(forged))).status).toBe(403);
  });
  it('blocks a token whose account was suspended after login', async () => {
    const x = await login('9900000003', 'CUSTOMER');
    await pool.query(`UPDATE users SET status='SUSPENDED' WHERE id=$1`, [x.user.id]);
    expect((await request(app).get('/customers/profile').set(bearer(x.accessToken))).status).toBe(403);
  });
  it('rejects an invalid admin query value', async () => {
    expect((await request(app).get('/admin/drivers?status=HACKED').set(bearer(admin))).status).toBe(400);
  });
});

describe('profiles', () => {
  it('updates a customer profile and validates input', async () => {
    const bad = await request(app).put('/customers/profile').set(bearer(customer)).send({ fullName: 'A' });
    expect(bad.status).toBe(400);
    const ok = await request(app).put('/customers/profile').set(bearer(customer)).send({ fullName: 'Ramandeep Kaur', email: 'Ram@Example.com' });
    expect(ok.status).toBe(200);
    expect(ok.body.profile.fullName).toBe('Ramandeep Kaur');
    expect(ok.body.profile.email).toBe('ram@example.com');
  });
  it('refuses an email already used by someone else', async () => {
    const other = await login('9900000004', 'CUSTOMER');
    const r = await request(app).put('/customers/profile').set(bearer(other.accessToken)).send({ fullName: 'Other Person', email: 'ram@example.com' });
    expect(r.status).toBe(409);
  });
  it('updates a driver profile and reports verification status', async () => {
    const up = await request(app).put('/drivers/profile').set(bearer(driver)).send({ fullName: 'Harjit Singh', address: 'Phase 5, Mohali' });
    expect(up.status).toBe(200);
    const st = await request(app).get('/drivers/verification-status').set(bearer(driver));
    expect(st.body.status).toBe('DRAFT');
    expect(st.body.documents).toEqual([]);
  });
});

describe('database safety rules', () => {
  it('does not allow an unverified driver to be online', async () => {
    await expect(pool.query(`UPDATE drivers SET is_online=true WHERE status <> 'VERIFIED'`)).rejects.toThrow(/drivers_online_requires_verified/);
  });
  it('does not allow a malformed phone number', async () => {
    await expect(pool.query(`INSERT INTO users(role,phone) VALUES ('CUSTOMER','12345')`)).rejects.toThrow();
  });
  it('allows only one active pricing row, starting at 10 per km', async () => {
    const r = await pool.query('SELECT minimum_price_per_km FROM pricing_settings WHERE is_active');
    expect(r.rowCount).toBe(1);
    expect(Number(r.rows[0].minimum_price_per_km)).toBe(10);
    await expect(pool.query(`INSERT INTO pricing_settings(is_active, minimum_price_per_km) VALUES (true, 11)`)).rejects.toThrow(/uq_pricing_one_active/);
  });
});
