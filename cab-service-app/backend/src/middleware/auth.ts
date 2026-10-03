import { NextFunction, Request, Response } from 'express';
import { query } from '../db/pool';
import { forbidden, unauthorized } from '../utils/errors';
import { Role, verifyAccess } from '../utils/jwt';

declare global {
  namespace Express { interface Request { user?: { id: string; role: Role } } }
}

/** Requires a valid access token and an ACTIVE account. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) throw unauthorized('Please log in.', 'NO_TOKEN');
    let claims;
    try { claims = verifyAccess(h.slice(7)); } catch { throw unauthorized('Session expired. Please log in again.', 'TOKEN_INVALID'); }
    const { rows } = await query('SELECT id, role, status FROM users WHERE id=$1 AND deleted_at IS NULL', [claims.sub]);
    const u = rows[0];
    if (!u) throw unauthorized('Please log in again.', 'TOKEN_INVALID');
    if (u.status !== 'ACTIVE') throw forbidden('This account is not active. Please contact support.', 'ACCOUNT_INACTIVE');
    req.user = { id: u.id, role: u.role }; // role comes from the database, not from the token
    next();
  } catch (e) { next(e); }
}

/** Use after authenticate(). Example: router.get('/x', authenticate, requireRole('ADMIN'), handler) */
export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) =>
  req.user && roles.includes(req.user.role) ? next() : next(forbidden('You do not have access to this.', 'WRONG_ROLE'));
