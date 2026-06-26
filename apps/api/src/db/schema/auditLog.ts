import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Audit Log table — Phase 2 security addition.
 *
 * Records every authentication event and data mutation for security monitoring.
 * Used by the /admin/security-events endpoint (Phase 7) with filters for
 * time range, event type, and IP address.
 *
 * Written on:
 * - Login success/failure
 * - Logout
 * - Token refresh
 * - Password reset request/completion
 * - Email verification
 * - Account lockout
 * - Every data mutation (create, update, delete)
 * - Every IDOR attempt (ownership check failure)
 *
 * NEVER logged: passwords, tokens, raw SQL queries with data.
 */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** User who performed the action (null for failed auth attempts with unknown user) */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  /**
   * Action identifier — follows a verb:noun pattern.
   * Examples: 'auth:login_success', 'auth:login_failure', 'auth:logout',
   * 'auth:token_refresh', 'auth:password_reset_request', 'auth:email_verified',
   * 'auth:account_locked', 'card:created', 'card:updated', 'card:deleted',
   * 'media:uploaded', 'practice:submitted', 'idor:attempt'
   */
  action: varchar('action', { length: 100 }).notNull(),

  /** Type of resource affected */
  resourceType: varchar('resource_type', { length: 100 }),

  /** ID of the affected resource */
  resourceId: uuid('resource_id'),

  /** Client IP address (IPv4 or IPv6, max 45 chars) */
  ipAddress: varchar('ip_address', { length: 45 }),

  /** Client user agent string for device/browser identification */
  userAgent: text('user_agent'),

  /** Additional context as JSON (e.g., failed field, old vs new values for updates) */
  details: text('details'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
