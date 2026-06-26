import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors.js';

/**
 * Zod validation middleware factory.
 *
 * Validates and sanitises ALL inputs at the API boundary.
 * Rejects requests that fail validation with a 400 and descriptive error.
 *
 * Validates three parts of the request:
 * - body: POST/PUT/PATCH request body
 * - query: URL query parameters
 * - params: URL path parameters
 */
interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => `body.${e.path.join('.')}: ${e.message}`));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => `query.${e.path.join('.')}: ${e.message}`));
      } else {
        // Express 5 makes req.query a getter. We must mutate the keys instead of assigning a new object.
        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }
        Object.assign(req.query, result.data);
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => `params.${e.path.join('.')}: ${e.message}`));
      } else {
        // Express 5 makes req.params a getter. We must mutate the keys instead of assigning a new object.
        for (const key of Object.keys(req.params)) {
          delete req.params[key];
        }
        Object.assign(req.params, result.data);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestError(`Validation failed: ${errors.join('; ')}`);
    }

    next();
  };
}

/**
 * Common validation patterns reusable across endpoints.
 */
export const commonSchemas = {
  /** UUID v4 format validator */
  uuid: z.string().uuid('Invalid UUID format'),

  /** Pagination query params */
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  /** UUID params for single resource routes */
  idParam: z.object({
    id: z.string().uuid('Invalid resource ID'),
  }),
};
