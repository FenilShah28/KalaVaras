import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * ENUM for sync queue action types and statuses.
 */
export const syncActionEnum = pgEnum('sync_action_type', [
  'upload_video',
  'publish_card',
  'submit_practice',
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'syncing',
  'done',
  'failed',
]);

/**
 * Sync Queue table — Document 5 Section 5.1 (offline support).
 *
 * Stores actions queued when the user is offline.
 * On reconnect, the client batch-POSTs these to /sync.
 * The server validates each queued action's ownership before processing.
 *
 * Security: owner_id is validated against the authenticated user
 * on each sync action — prevents replay attacks with spoofed user_ids.
 */
export const syncQueue = pgTable('sync_queue', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** Owner of this queued action — validated on sync */
  ownerId: uuid('owner_id').references(() => users.id).notNull(),

  /** Legacy alias matching Doc 5 */
  userId: uuid('user_id').references(() => users.id),

  actionType: syncActionEnum('action_type').notNull(),

  /** Serialised action data — validated with Zod on the server before processing */
  payload: jsonb('payload').notNull(),

  status: syncStatusEnum('status').default('pending').notNull(),

  /** When the action was originally created on the client (offline) */
  createdOfflineAt: timestamp('created_offline_at', { withTimezone: true }),

  /** When the server successfully processed this action */
  syncedAt: timestamp('synced_at', { withTimezone: true }),
});
