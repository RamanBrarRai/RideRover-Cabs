import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type Role = 'CUSTOMER' | 'DRIVER' | 'ADMIN';
export interface AccessClaims { sub: string; role: Role }

export function signAccess(userId: string, role: Role) {
  return jwt.sign({ role }, env.JWT_SECRET, { subject: userId, expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`, algorithm: 'HS256' });
}
export function verifyAccess(token: string): AccessClaims {
  const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  return { sub: String(p.sub), role: p.role as Role };
}
