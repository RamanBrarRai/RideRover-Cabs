import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That address does not exist.' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Some details are not valid.', fields: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) } });
  }
  if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if ((err as any)?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  if (env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again.' } });
}
