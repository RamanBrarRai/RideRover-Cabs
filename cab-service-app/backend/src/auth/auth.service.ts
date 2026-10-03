import { PoolClient } from 'pg';
import { env } from '../config/env';
import { query, tx } from '../db/pool';
import { AppError, conflict, forbidden, tooMany, unauthorized } from '../utils/errors';
import { hashOtp, hashPassword, hashRefresh, randomOtp, randomToken, safeEqual, verifyPassword } from '../utils/crypto';
import { Role, signAccess } from '../utils/jwt';
import { getSmsProvider } from './sms';

const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_PER_HOUR = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ADMIN_FAILS = 5;
const ADMIN_LOCK_MINUTES = 15;

export interface TokenPair { accessToken: string; refreshToken: string; expiresInSeconds: number }

export async function sendOtp(phone: string) {
  const recent = await query<{ created_at: Date }>(
    `SELECT created_at FROM otp_codes WHERE phone=$1 AND created_at > now() - interval '1 hour' ORDER BY created_at DESC`, [phone]);
  if (recent.rows.length >= MAX_OTP_PER_HOUR) throw tooMany('Too many codes requested. Please try again in an hour.', 'OTP_LIMIT');
  if (recent.rows[0] && Date.now() - recent.rows[0].created_at.getTime() < RESEND_COOLDOWN_SECONDS * 1000)
    throw tooMany(`Please wait ${RESEND_COOLDOWN_SECONDS} seconds before asking for a new code.`, 'OTP_COOLDOWN');

  const otp = randomOtp();
  await query(`UPDATE otp_codes SET consumed_at=now() WHERE phone=$1 AND consumed_at IS NULL`, [phone]);
  await query(`INSERT INTO otp_codes(phone, code_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' seconds')::interval)`,
    [phone, hashOtp(phone, otp), String(env.OTP_TTL_SECONDS)]);
  await getSmsProvider().sendOtp(phone, otp);
  return { expiresInSeconds: env.OTP_TTL_SECONDS };
}

async function issueTokens(userId: string, role: Role, c?: PoolClient): Promise<TokenPair> {
  const refreshToken = randomToken();
  const sql = `INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)`;
  const params = [userId, hashRefresh(refreshToken), String(env.REFRESH_TOKEN_TTL_DAYS)];
  if (c) await c.query(sql, params); else await query(sql, params);
  return { accessToken: signAccess(userId, role), refreshToken, expiresInSeconds: env.ACCESS_TOKEN_TTL_MIN * 60 };
}

export async function verifyOtp(phone: string, otp: string, role: 'CUSTOMER' | 'DRIVER') {
  const { rows } = await query<{ id: string; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM otp_codes WHERE phone=$1 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`, [phone]);
  const row = rows[0];
  if (!row) throw new AppError(400, 'OTP_EXPIRED', 'This code has expired. Please ask for a new one.');
  if (row.attempts >= MAX_OTP_ATTEMPTS) throw tooMany('Too many wrong attempts. Please ask for a new code.', 'OTP_ATTEMPTS');
  if (!safeEqual(row.code_hash, hashOtp(phone, otp))) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [row.id]);
    throw new AppError(400, 'OTP_INVALID', 'That code is not correct.');
  }

  return tx(async (c) => {
    // consume atomically so one code can only ever be used once
    const used = await c.query('UPDATE otp_codes SET consumed_at=now() WHERE id=$1 AND consumed_at IS NULL', [row.id]);
    if (used.rowCount !== 1) throw new AppError(400, 'OTP_EXPIRED', 'This code has already been used.');

    let u = (await c.query('SELECT id, role, status FROM users WHERE phone=$1 FOR UPDATE', [phone])).rows[0];
    let isNew = false;
    if (u) {
      if (u.role !== role) throw conflict(`This number is registered as a ${String(u.role).toLowerCase()}.`, 'ROLE_MISMATCH');
      if (u.status !== 'ACTIVE') throw forbidden('This account is not active. Please contact support.', 'ACCOUNT_INACTIVE');
    } else {
      u = (await c.query(`INSERT INTO users(role, phone) VALUES ($1,$2) RETURNING id, role, status`, [role, phone])).rows[0];
      await c.query(role === 'CUSTOMER' ? 'INSERT INTO customers(user_id) VALUES ($1)' : 'INSERT INTO drivers(user_id) VALUES ($1)', [u.id]);
      isNew = true;
    }
    await c.query('UPDATE users SET last_login_at=now() WHERE id=$1', [u.id]);
    const tokens = await issueTokens(u.id, role, c);
    return { ...tokens, isNewUser: isNew, user: { id: u.id as string, role } };
  });
}

class TokenReuse extends Error { constructor(public userId: string) { super('reuse'); } }

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const h = hashRefresh(refreshToken);
  try {
    return await tx(async (c) => {
      const t = (await c.query('SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash=$1 FOR UPDATE', [h])).rows[0];
      if (!t) throw unauthorized('Session expired. Please log in again.', 'SESSION_EXPIRED');
      if (t.revoked_at) throw new TokenReuse(t.user_id);
      if (t.expires_at < new Date()) throw unauthorized('Session expired. Please log in again.', 'SESSION_EXPIRED');
      const u = (await c.query('SELECT id, role, status FROM users WHERE id=$1', [t.user_id])).rows[0];
      if (!u || u.status !== 'ACTIVE') throw forbidden('This account is not active.', 'ACCOUNT_INACTIVE');
      await c.query('UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1', [t.id]);
      return issueTokens(u.id, u.role, c);
    });
  } catch (e) {
    if (e instanceof TokenReuse) {
      // A used token came back: someone may have copied it. End every session for this user.
      await query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [e.userId]);
      throw unauthorized('Session expired. Please log in again.', 'SESSION_REUSED');
    }
    throw e;
  }
}

export async function logout(refreshToken: string) {
  await query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL', [hashRefresh(refreshToken)]);
}

export async function adminLogin(email: string, password: string) {
  const { rows } = await query(
    `SELECT u.id, u.status, a.password_hash, a.failed_logins, a.locked_until
       FROM users u JOIN admin_users a ON a.user_id=u.id WHERE u.email=$1 AND u.role='ADMIN'`, [email.toLowerCase()]);
  const a = rows[0];
  if (a?.locked_until && a.locked_until > new Date())
    throw tooMany('Too many failed attempts. Try again in a few minutes.', 'ADMIN_LOCKED');
  // verify even when the email is unknown so response time does not reveal which emails exist
  const ok = verifyPassword(password, a?.password_hash ?? hashPassword('x'.repeat(12)));
  if (!a || !ok) {
    if (a) {
      const fails = a.failed_logins + 1;
      await query('UPDATE admin_users SET failed_logins=$2::int, locked_until = CASE WHEN $2::int >= $3::int THEN now() + ($4 || \' minutes\')::interval ELSE NULL END WHERE user_id=$1',
        [a.id, fails, MAX_ADMIN_FAILS, String(ADMIN_LOCK_MINUTES)]);
    }
    throw unauthorized('Email or password is incorrect.', 'BAD_CREDENTIALS');
  }
  if (a.status !== 'ACTIVE') throw forbidden('This account is not active.', 'ACCOUNT_INACTIVE');
  await query('UPDATE admin_users SET failed_logins=0, locked_until=NULL WHERE user_id=$1', [a.id]);
  await query('UPDATE users SET last_login_at=now() WHERE id=$1', [a.id]);
  const tokens = await issueTokens(a.id, 'ADMIN');
  await query(`INSERT INTO audit_logs(actor_id, actor_role, action) VALUES ($1,'ADMIN','admin.login')`, [a.id]);
  return { ...tokens, user: { id: a.id as string, role: 'ADMIN' as const } };
}
