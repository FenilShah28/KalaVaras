import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * JWT types for token payloads.
 */
export interface JwtPayload {
  userId: string;
  role: 'artisan' | 'apprentice' | 'researcher' | 'admin';
  emailVerified: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Extend Express Request to include authenticated user data.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware — verifies JWT access token from Authorization header.
 *
 * Access token is sent in `Authorization: Bearer <token>` header ONLY.
 * Never in URL params, query strings, or cookies (refresh token uses cookies).
 *
 * On success: populates req.user with decoded payload.
 * On failure: throws UnauthorizedError (401).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token required');
  }

  const token = authHeader.substring(7); // Strip 'Bearer '

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid access token');
    }
    throw new UnauthorizedError('Authentication failed');
  }
}

/**
 * Role-based access control middleware.
 * Must be used AFTER authenticate().
 * Accepts an array of allowed roles.
 */
export function requireRole(...roles: JwtPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      // Return 404 instead of 403 to avoid leaking route existence
      throw new UnauthorizedError('Access denied');
    }

    next();
  };
}

/**
 * Middleware to block actions for unverified email accounts.
 * Allows only profile view until email_verified = true.
 */
export function requireEmailVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  if (!req.user.emailVerified) {
    throw new UnauthorizedError('Email verification required');
  }

  next();
}
