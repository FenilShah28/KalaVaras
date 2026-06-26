import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Redis client for Bull job queues, session storage, and rate-limit backing store.
 * Frontend never connects to Redis directly — server-side only.
 */
export const redis = env.USE_LOCAL_MOCKS 
  ? new RedisMock() as unknown as Redis.Redis
  : new Redis.default(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err: Error) => {
  logger.error('Redis connection error', { error: err.message });
});
