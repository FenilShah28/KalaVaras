import helmet from 'helmet';
import { env } from '../config/env.js';

/**
 * Helmet security headers — first middleware in the stack.
 *
 * Configures:
 * - CSP: strict content security policy (no inline scripts, no eval)
 * - HSTS: max-age 1 year, includeSubDomains
 * - X-Frame-Options: DENY (prevents clickjacking)
 * - X-Content-Type-Options: nosniff
 * - Referrer-Policy: strict-origin-when-cross-origin
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', env.R2_PUBLIC_URL],
      mediaSrc: ["'self'", 'blob:', env.R2_PUBLIC_URL],
      connectSrc: ["'self'", env.FRONTEND_URL],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // Needed for cross-origin media from R2
});
