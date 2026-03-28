import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware that assigns a unique request ID to every incoming request.
 * If the client already sent an `x-request-id` header, that value is reused;
 * otherwise a new UUID v4 is generated.  The ID is attached to `req.requestId`
 * and echoed back via the `x-request-id` response header so that callers can
 * correlate responses and logs with a specific request.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientId = req.headers['x-request-id'] as string;
  const requestId = (clientId && UUID_REGEX.test(clientId)) ? clientId : crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
