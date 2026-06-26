import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

/**
 * Tiered rate limiters by endpoint category.
 *
 * In production: Redis-backed store ensures limits apply across
 * all horizontally-scaled API instances (not per-process memory).
 *
 * Rate limits:
 * - Auth endpoints:        5 req / min  (brute-force prevention)
 * - Upload endpoints:     10 req / min
 * - Read endpoints:      100 req / min
 * - Processing endpoints: 20 req / min
 * - Account creation:      3 per IP / hour
 */

const createRedisStore = () =>
  new RedisStore({
    sendCommand: (...args: string[]) => (redis as any).call(...args),
  });

const isProd = env.NODE_ENV === 'production';

/** Auth endpoints — 5 requests per minute per IP */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: isProd ? createRedisStore() : undefined,
  message: {
    success: false,
    data: null,
    error: 'Too many authentication attempts. Please try again later.',
  },
});

/** Upload endpoints — 10 requests per minute per IP */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: isProd ? createRedisStore() : undefined,
  message: {
    success: false,
    data: null,
    error: 'Upload rate limit exceeded. Please try again later.',
  },
});

/** Read endpoints — 100 requests per minute per IP */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: isProd ? createRedisStore() : undefined,
  message: {
    success: false,
    data: null,
    error: 'Rate limit exceeded. Please try again later.',
  },
});

/** AI/Processing endpoints — 20 requests per minute per IP */
export const processingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: isProd ? createRedisStore() : undefined,
  message: {
    success: false,
    data: null,
    error: 'Processing rate limit exceeded. Please try again later.',
  },
});

/** Account creation — 3 per IP per hour (high limit in development) */
export const accountCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 3 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: isProd ? createRedisStore() : undefined,
  message: {
    success: false,
    data: null,
    error: 'Too many accounts created from this IP. Please try again later.',
  },
});
