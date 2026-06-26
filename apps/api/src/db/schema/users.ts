import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * ENUM definitions matching Document 5 specifications.
 */
export const roleEnum = pgEnum('user_role', ['artisan', 'apprentice', 'researcher', 'admin']);

/**
 * Users table — Document 5 Section 5.1 + Phase 2 security additions.
 *
 * Security columns added:
 * - password_hash: bcrypt hash (cost 12), never returned in API responses
 * - email_verified: blocks authenticated actions until true
 * - email_verification_token/expires: SHA-256 hashed token + expiry
 * - password_reset_token/expires: SHA-256 hashed token + 1hr expiry
 * - failed_login_attempts + locked_until: account lockout after 10 failures
 * - last_login_ip + last_login_at: audit trail
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 15 }).unique(),
  nameMarathi: varchar('name_marathi', { length: 100 }).notNull(),
  nameEnglish: varchar('name_english', { length: 100 }),
  role: roleEnum('role').notNull(),
  village: varchar('village', { length: 100 }),
  district: varchar('district', { length: 100 }).default('Pune'),
  traditions: text('traditions').array(), // ['warli', 'kolam', 'pichwai', 'madhubani']
  yearsExperience: integer('years_experience'),
  avatarUrl: text('avatar_url'),
  consentGivenAt: timestamp('consent_given_at', { withTimezone: true }),

  // --- Security columns (Phase 2 additions) ---
  /** bcrypt hash at cost factor 12 — NEVER returned in any API response */
  passwordHash: varchar('password_hash', { length: 255 }),
  /** Blocks all authenticated actions except profile view until true */
  emailVerified: boolean('email_verified').default(false).notNull(),
  /** SHA-256 hash of the raw verification token — never store/compare raw */
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  /** 24 hours from registration */
  emailVerificationExpires: timestamp('email_verification_expires', { withTimezone: true }),
  /** SHA-256 hash of the raw reset token */
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  /** 1 hour from request */
  passwordResetExpires: timestamp('password_reset_expires', { withTimezone: true }),
  /** Incremented on each failed login, reset to 0 on success */
  failedLoginAttempts: smallint('failed_login_attempts').default(0).notNull(),
  /** Account locked until this time after 10 failed attempts */
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  /** IPv4 or IPv6 (max 45 chars for IPv6) */
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

  // --- Timestamps ---
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActive: timestamp('last_active', { withTimezone: true }),
});
