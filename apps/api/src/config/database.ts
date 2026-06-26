import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePgLite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { env } from './env.js';

/**
 * PostgreSQL connection pool or PGLite for local mocking.
 * All queries use Drizzle's parameterised query builder — zero raw SQL interpolation.
 */
import { fileURLToPath } from 'url';
import path from 'path';

let db: any;
let pool: any;

if (env.USE_LOCAL_MOCKS) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbPath = path.resolve(__dirname, '../../../../.tmp/pglite_db');
  
  const client = new PGlite(dbPath);
  db = drizzlePgLite(client);
  pool = null;
} else {
  pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  db = drizzleNodePg(pool);
}

export { db, pool };
