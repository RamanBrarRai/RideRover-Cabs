import { Request } from 'express';
import { query } from '../db/pool';

export async function audit(req: Request, action: string, entity?: string, entityId?: string, details?: unknown) {
  await query('INSERT INTO audit_logs(actor_id, actor_role, action, entity, entity_id, details, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [req.user?.id ?? null, req.user?.role ?? null, action, entity ?? null, entityId ?? null, details ? JSON.stringify(details) : null, req.ip ?? null]);
}
