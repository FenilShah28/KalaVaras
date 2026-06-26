import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two levels up from apps/api/src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Zod schema for ALL environment variables.
 * Server refuses to start if any required variable is missing or invalid.
 * This prevents runtime crashes from missing config — fail fast at boot.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url(),

  // PostgreSQL
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT — access and refresh MUST be different secrets
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // Internal service-to-service auth
  INTERNAL_SERVICE_SECRET: z.string().min(16, 'INTERNAL_SERVICE_SECRET must be at least 16 characters'),
  SLIT_SCAN_SERVICE_URL: z.string().url(),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),

  // Mocking (No Docker needed)
  USE_LOCAL_MOCKS: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Runtime guard: access and refresh secrets must differ
if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  console.error('❌ JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
