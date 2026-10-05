export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const badRequest = (m: string, code = 'BAD_REQUEST') => new AppError(400, code, m);
export const unauthorized = (m = 'Please log in again.', code = 'UNAUTHORIZED') => new AppError(401, code, m);
export const forbidden = (m = 'You are not allowed to do this.', code = 'FORBIDDEN') => new AppError(403, code, m);
export const notFound = (m = 'Not found.', code = 'NOT_FOUND') => new AppError(404, code, m);
export const conflict = (m: string, code = 'CONFLICT') => new AppError(409, code, m);
export const tooMany = (m: string, code = 'TOO_MANY_REQUESTS') => new AppError(429, code, m);
