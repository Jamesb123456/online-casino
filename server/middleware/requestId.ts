import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware that assigns a unique request ID to every incoming request.
 * If the client already sent an `x-request-id` header, that value is reused;
 * otherwise a new UUID v4 is generated.  The ID is attached to `req.requestId`
 * and echoed back via the `x-request-id` response header so that callers can
 * correlate responses and logs with a specific request.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
