import {
  pgTable,
  uuid,
  text,
  bigint,
  real,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { strokeCards } from './strokeCards.js';

/**
 * ENUM for media asset types.
 */
export const mediaTypeEnum = pgEnum('media_type', [
  'source_video',
  'slit_scan',
  'rhythm_waveform',
  'clay_scan',
  'card_gif',
]);

export const processingStatusEnum = pgEnum('processing_status', [
  'pending',
  'processing',
  'complete',
  'failed',
]);

/**
 * Media Assets table — Document 5 Section 5.1.
 *
 * Stores references to media files in Cloudflare R2.
 * Each asset is tied to a stroke card and has an explicit owner_id.
 *
 * File security:
 * - Files renamed to UUID on upload (original filename never stored)
 * - MIME whitelist enforced at upload (video/mp4, video/webm, image/jpeg, image/png)
 * - Max 5MB file size
 * - EXIF stripped from images via sharp before storage
 */
export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** Explicit ownership — required for IDOR prevention */
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

  strokeCardId: uuid('stroke_card_id').references(() => strokeCards.id, { onDelete: 'cascade' }),
  type: mediaTypeEnum('type').notNull(),

  /** Cloudflare R2 object key — never contains original filename */
  storageKey: text('storage_key').notNull(),
  /** CDN URL for client access */
  url: text('url').notNull(),

  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  /** Duration in seconds — for video assets */
  durationSeconds: real('duration_seconds'),

  processingStatus: processingStatusEnum('processing_status').default('pending').notNull(),

  /**
   * JSONB metadata bag.
   * Structure: {width, height, fps, peak_times[], slit_column_width}
   */
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
