import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, login, makeAdmin, pool, resetDb, sentOtps } from './helpers';

beforeAll(resetDb);
afterAll(() => pool.end());
beforeEach(async () => { await pool.query('DELETE FROM otp_codes'); });

const P = '9811111111';

describe('send-otp', () => {
  it('rejects an invalid phone number', async () => {
    const r = await request(app).post('/auth/send-otp').send({ phone: '12345', role: 'CUSTOMER' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION');
  });
  it('rejects the ADMIN role (admins use email and password)', async () => {
    const r = await request(app).post('/auth/send-otp').send({ phone: P, role: 'ADMIN' });
    expect(r.status).toBe(400);
  });
  it('stores only a hash of the code, never the code itself', async () => {
    await request(app).post('/auth/send-otp').send({ phone: P, role: 'CUSTOMER' }).expect(200);
    const row = (await pool.query('SELECT code_hash FROM otp_codes WHERE phone=$1', [P])).rows[0];
    expect(row.code_hash).not.toContain(sentOtps.get(P));
    expect(row.code_hash).toHaveLength(64);
  });
  it('enforces a resend cooldown', async () => {
    await request(app).post('/auth/send-otp').send({ phone: P, role: 'CUSTOMER' }).expect(200);
    const r = await request(app).post('/auth/send-otp').send({ phone: P, role: 'CUSTOMER' });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('OTP_COOLDOWN');
  });
  it('enforces an hourly limit per phone', async () => {
    for (let i = 0; i < 5; i++) await pool.query(`INSERT INTO otp_codes(phone,code_hash,expires_at,created_at) VALUES ($1,'x',now()+interval '1 min', now() - interval '10 minutes')`, [P]);
    const r = await request(app).post('/auth/send-otp').send({ phone: P, role: 'CUSTOMER' });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('OTP_LIMIT');
  });
});

describe('verify-otp', () => {
  it('rejects a wrong code and counts the attempt', async () => {
    await request(app).post('/auth/send-otp').send({ phone: P, role: 'CUSTOMER' });
    const real = sentOtps.get(P)!;
    const wrong = real === '000000' ? '111111' : '000000';
    const r = await request(app).post('/auth/verify-otp').send({ phone: P, role: 'CUSTOMER', otp: wrong });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('OTP_INVALID');
  });
  it('locks the code after 5 wrong attempts, even if the right code is then entered', async () => {
    await request(app).post('/auth/send-otp').send({ phone: P, role: 'CUSTOMER' });
    const real = sentOtps.get(P)!;
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await request(app).post('/auth/verify-otp').send({ phone: P, role: 'CUSTOMER', otp: wrong });
    const r = await request(app).post('/auth/verify-otp').send({ phone: P, role: 'CUSTOMER', otp: real });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('OTP_ATTEMPTS');
  });
  it('creates a customer on first login and not again on the second', async () => {
    const a = await login('9822222222', 'CUSTOMER');
    expect(a.isNewUser).toBe(true);
    expect(a.accessToken).toBeTruthy();
    const b = await login('9822222222', 'CUSTOMER');
    expect(b.isNewUser).toBe(false);
    expect(b.user.id).toBe(a.user.id);
    const n = await pool.query('SELECT count(*)::int AS n FROM customers WHERE user_id=$1', [a.user.id]);
    expect(n.rows[0].n).toBe(1);
  });
  it('creates a driver profile in DRAFT status for a driver login', async () => {
    const a = await login('9833333333', 'DRIVER');
    const d = await pool.query('SELECT status, is_online FROM drivers WHERE user_id=$1', [a.user.id]);
    expect(d.rows[0]).toEqual({ status: 'DRAFT', is_online: false });
  });
  it('does not let a customer number log in as a driver', async () => {
    await login('9844444444', 'CUSTOMER');
    await pool.query('DELETE FROM otp_codes');
    await request(app).post('/auth/send-otp').send({ phone: '9844444444', role: 'DRIVER' }).expect(200);
    const r = await request(app).post('/auth/verify-otp').send({ phone: '9844444444', role: 'DRIVER', otp: sentOtps.get('9844444444') });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('ROLE_MISMATCH');
  });
  it('lets a code be used only once', async () => {
    await request(app).post('/auth/send-otp').send({ phone: '9855555555', role: 'CUSTOMER' });
    const otp = sentOtps.get('9855555555');
    await request(app).post('/auth/verify-otp').send({ phone: '9855555555', role: 'CUSTOMER', otp }).expect(200);
    const again = await request(app).post('/auth/verify-otp').send({ phone: '9855555555', role: 'CUSTOMER', otp });
    expect(again.status).toBe(400);
  });
  it('rejects an expired code', async () => {
    await request(app).post('/auth/send-otp').send({ phone: '9866666666', role: 'CUSTOMER' });
    await pool.query(`UPDATE otp_codes SET expires_at = now() - interval '1 second' WHERE phone='9866666666'`);
    const r = await request(app).post('/auth/verify-otp').send({ phone: '9866666666', role: 'CUSTOMER', otp: sentOtps.get('9866666666') });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('OTP_EXPIRED');
  });
  it('blocks a suspended account', async () => {
    const a = await login('9877777777', 'CUSTOMER');
    await pool.query(`UPDATE users SET status='SUSPENDED' WHERE id=$1`, [a.user.id]);
    await pool.query('DELETE FROM otp_codes');
    await request(app).post('/auth/send-otp').send({ phone: '9877777777', role: 'CUSTOMER' });
    const r = await request(app).post('/auth/verify-otp').send({ phone: '9877777777', role: 'CUSTOMER', otp: sentOtps.get('9877777777') });
    expect(r.status).toBe(403);
  });
});

describe('refresh tokens and logout', () => {
  it('rotates the refresh token', async () => {
    const a = await login('9888888881', 'CUSTOMER');
    const r = await request(app).post('/auth/refresh').send({ refreshToken: a.refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.refreshToken).not.toBe(a.refreshToken);
    await request(app).get('/auth/me').set('Authorization', `Bearer ${r.body.accessToken}`).expect(200);
  });
  it('ends all sessions if an old refresh token is replayed', async () => {
    const a = await login('9888888882', 'CUSTOMER');
    const r1 = await request(app).post('/auth/refresh').send({ refreshToken: a.refreshToken }).expect(200);
    const replay = await request(app).post('/auth/refresh').send({ refreshToken: a.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_REUSED');
    const after = await request(app).post('/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(after.status).toBe(401);
  });
  it('logout stops the refresh token from working', async () => {
    const a = await login('9888888883', 'CUSTOMER');
    await request(app).post('/auth/logout').send({ refreshToken: a.refreshToken }).expect(200);
    const r = await request(app).post('/auth/refresh').send({ refreshToken: a.refreshToken });
    expect(r.status).toBe(401);
  });
  it('rejects a made-up refresh token', async () => {
    const r = await request(app).post('/auth/refresh').send({ refreshToken: 'x'.repeat(40) });
    expect(r.status).toBe(401);
  });
});

describe('admin login', () => {
  it('logs in with the right password and writes an audit log', async () => {
    await makeAdmin('boss@example.com', 'correct-horse-battery');
    const r = await request(app).post('/auth/admin/login').send({ email: 'boss@example.com', password: 'correct-horse-battery' });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('ADMIN');
    const log = await pool.query(`SELECT 1 FROM audit_logs WHERE action='admin.login'`);
    expect(log.rowCount).toBeGreaterThan(0);
  });
  it('rejects a wrong password with a message that does not reveal whether the email exists', async () => {
    const wrong = await request(app).post('/auth/admin/login').send({ email: 'boss@example.com', password: 'nope-nope-nope' });
    const unknown = await request(app).post('/auth/admin/login').send({ email: 'nobody@example.com', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });
  it('locks the account after 5 wrong passwords', async () => {
    await makeAdmin('locked@example.com', 'correct-horse-battery');
    for (let i = 0; i < 5; i++) await request(app).post('/auth/admin/login').send({ email: 'locked@example.com', password: 'wrong-wrong-1' });
    const r = await request(app).post('/auth/admin/login').send({ email: 'locked@example.com', password: 'correct-horse-battery' });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('ADMIN_LOCKED');
  });
});
