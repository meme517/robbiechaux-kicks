import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

/** Structured API error with an HTTP status. */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = 'server_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * ProviderError lives in provider/kicksdb.ts, which (transitively) imports the
 * database layer — importing it here would create a module cycle. Detect it by
 * its `name` marker instead.
 */
interface MarkedError extends Error {
  status?: number;
  kind?: string;
  code?: string;
}
function isMarkedError(err: unknown): err is MarkedError {
  return (
    err instanceof Error &&
    (err.name === 'ApiError' || err.name === 'ProviderError') &&
    typeof (err as MarkedError).status === 'number'
  );
}

/** 404 handler for unknown API routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found.' } });
}

/**
 * Central error handler — never leaks stack traces or secrets.
 * Only errors we deliberately constructed (ApiError / ProviderError) have their
 * message shown; anything else — Mongo driver errors, socket errors, TypeError —
 * is reported with a generic message so internals never reach the client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const trusted = isMarkedError(err);
  const status = trusted ? (err.status as number) : 500;
  const name = err instanceof Error ? err.name : '';
  const code = trusted
    ? name === 'ProviderError'
      ? `provider_${(err as MarkedError).kind ?? 'error'}`
      : ((err as MarkedError).code ?? 'server_error')
    : 'server_error';
  const message = trusted && err.message ? err.message : 'Unexpected server error. Please try again later.';

  if (status >= 500) {
    console.error('[api] error:', err instanceof Error ? (err.stack ?? err.message) : err);
  }

  res.status(status).json({ error: { code, message } });
}

/** Protect owner-only endpoints with the ADMIN_TOKEN shared secret. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const expected = config.admin.token;
  if (!expected) {
    next(new ApiError('Admin access is not configured (ADMIN_TOKEN is unset).', 503, 'admin_disabled'));
    return;
  }
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.header('x-admin-token') || '';
  if (token !== expected) {
    next(new ApiError('Unauthorized.', 401, 'unauthorized'));
    return;
  }
  next();
}
