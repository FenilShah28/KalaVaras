import type { Request, Response, NextFunction } from 'express';
import { AppError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * Global error handler — catches all thrown errors and returns consistent envelope.
 *
 * Security rules:
 * - In production: never expose stack traces to the client.
 * - ForbiddenError (403) is mapped to 404 externally to prevent leaking resource existence.
 * - All errors are logged with X-Request-ID for correlation.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as unknown as Record<string, unknown>).requestId as string || 'unknown';

  // Map ForbiddenError to 404 in responses to prevent leaking resource existence
  // The internal log still records it as a 403/IDOR attempt
  if (err instanceof ForbiddenError) {
    logger.warn('Ownership check failed — returning 404 to client', {
      requestId,
      endpoint: req.path,
      method: req.method,
      statusCode: 403,
      ip: req.ip,
    });

    res.status(404).json({
      success: false,
      data: null,
      error: 'Resource not found',
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn('Application error', {
      requestId,
      endpoint: req.path,
      method: req.method,
      statusCode: err.statusCode,
      message: err.message,
    });

    res.status(err.statusCode).json({
      success: false,
      data: null,
      error: err.message,
    });
    return;
  }

  // Unexpected errors — log full stack internally, return generic message externally
  logger.error('Unhandled error', {
    requestId,
    endpoint: req.path,
    method: req.method,
    statusCode: 500,
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    data: null,
    error: env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
}
