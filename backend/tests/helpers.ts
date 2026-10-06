import request from 'supertest';
import { createApp } from '../src/app';
import { pool, query } from '../src/db/pool';
import { migrate } from '../src/db/migrate';
import { setSmsProvider } from '../src/auth/sms';
import { hashPassword } from '../src/utils/crypto';

export const app = createApp();
export const sentOtps = new Map<string, string>();
setSmsProvider({ async sendOtp(phone, otp) { sentOtps.set(phone, otp); } });

export async function resetDb() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(false);
}

/** Full OTP login through the real API. */
export async function login(phone: string, role: 'CUSTOMER' | 'DRIVER') {
  await query('DELETE FROM otp_codes WHERE phone=$1', [phone]); // skip the resend cooldown for test setup
  await request(app).post('/auth/send-otp').send({ phone, role }).expect(200);
  const r = await request(app).post('/auth/verify-otp').send({ phone, role, otp: sentOtps.get(phone) }).expect(200);
  return r.body as { accessToken: string; refreshToken: string; isNewUser: boolean; user: { id: string; role: string } };
}

export async function makeAdmin(email: string, password: string) {
  const u = await query(`INSERT INTO users(role,email) VALUES ('ADMIN',$1) RETURNING id`, [email]);
  await query(`INSERT INTO admin_users(user_id,full_name,password_hash,admin_role) VALUES ($1,'Test Admin',$2,'SUPER_ADMIN')`, [u.rows[0].id, hashPassword(password)]);
  return u.rows[0].id as string;
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
export { pool };
