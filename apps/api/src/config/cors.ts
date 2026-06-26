import cors from 'cors';
import { env } from './env.js';

/**
 * CORS whitelist — only FRONTEND_URL from env is allowed.
 * Never use origin: '*' in production. This is a hard security constraint.
 */
export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = [env.FRONTEND_URL];
    
    const isLocalhost = env.NODE_ENV === 'development' && (
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:') ||
      origin === 'http://localhost' ||
      origin === 'http://127.0.0.1'
    );

    if (allowedOrigins.includes(origin) || isLocalhost) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // Required for httpOnly cookie refresh tokens
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400, // 24 hours preflight cache
};
