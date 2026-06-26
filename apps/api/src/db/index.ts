/**
 * Database barrel export.
 * Re-exports the Drizzle db instance and all schemas.
 */
export { db, pool } from '../config/database.js';
export * from './schema/index.js';
