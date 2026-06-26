import type { Response } from 'express';

/**
 * Consistent API response envelope.
 * Every endpoint MUST use these helpers — never return raw objects.
 * Format: { success: boolean, data: any, error: string | null }
 */

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
}

export function sendError(res: Response, error: string, statusCode = 500): void {
  res.status(statusCode).json({
    success: false,
    data: null,
    error,
  });
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
