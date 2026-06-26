import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log directory at project root
const LOG_DIR = path.resolve(__dirname, '../../../../logs');

/**
 * Winston logger with security-conscious transport strategy.
 *
 * NEVER log: passwords, tokens, full credit card numbers, full file paths, raw SQL with data.
 * ALWAYS log: timestamps, request IDs, user IDs (when available), IP addresses for security events.
 *
 * Transports:
 * - Console: always active (development + production)
 * - File (app.log): production only — general application logs
 * - File (error.log): production only — errors (4xx, 5xx)
 * - File (security.log): production only — auth events, IDOR attempts, lockouts
 */

const isProduction = process.env.NODE_ENV === 'production';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? logFormat : consoleFormat,
  }),
];

// File transports only in production — never log sensitive data
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'security.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'kalavaras-api' },
  transports,
});

/**
 * Security-specific logger — writes to security.log in production.
 * Use for: login success/failure, logout, token refresh, password reset,
 * email verification, account lockout, IDOR attempts.
 */
export const securityLogger = {
  authEvent(event: string, data: Record<string, unknown>) {
    logger.info(`[SECURITY] ${event}`, {
      ...data,
      category: 'auth',
    });
  },

  idorAttempt(data: Record<string, unknown>) {
    logger.warn('[SECURITY] IDOR attempt detected', {
      ...data,
      category: 'idor',
    });
  },

  suspiciousActivity(data: Record<string, unknown>) {
    logger.warn('[SECURITY] Suspicious activity', {
      ...data,
      category: 'suspicious',
    });
  },
};
