import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * X-Request-ID middleware — adds a unique request ID to every response.
 * Used for distributed tracing and correlating logs to user reports.
 *
 * If the client sends an X-Request-ID header, it is preserved.
 * Otherwise, a new UUIDv4 is generated.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || uuidv4();

  // Make available on request object for downstream logging
  (req as unknown as Record<string, unknown>).requestId = id;

  // Set on response so client can reference in bug reports
  res.setHeader('X-Request-ID', id);

  next();
}
