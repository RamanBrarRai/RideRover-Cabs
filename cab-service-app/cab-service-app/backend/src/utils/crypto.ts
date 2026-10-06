import crypto from 'crypto';
import { env } from '../config/env';

export const hmac = (secret: string, value: string) => crypto.createHmac('sha256', secret).update(value).digest('hex');
export const randomOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
export const randomToken = () => crypto.randomBytes(48).toString('base64url');
export const hashOtp = (phone: string, otp: string) => hmac(env.JWT_SECRET, `${phone}:${otp}`);
export const hashRefresh = (token: string) => hmac(env.JWT_REFRESH_SECRET, token);

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Passwords (admins only) use scrypt from Node's built-in crypto, so there is nothing extra to install.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return safeEqual(key.toString('hex'), keyHex);
}
