import {
  pgTable,
  uuid,
  integer,
  real,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { strokeCards } from './strokeCards.js';

/**
 * Practice Sessions table — Document 5 Section 5.1.
 *
 * Records apprentice practice attempts against master stroke cards.
 * owner_id maps to the apprentice who owns this practice session.
 *
 * Deviation and rhythm scores range from 0.0 (perfect) to 1.0 (high deviation).
 */
export const practiceSessions = pgTable('practice_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** Explicit ownership — the apprentice who did this practice */
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  /** Alias for backwards compatibility with Doc 5 spec */
  apprenticeId: uuid('apprentice_id').references(() => users.id, { onDelete: 'cascade' }),

  strokeCardId: uuid('stroke_card_id').references(() => strokeCards.id).notNull(),

  attemptNumber: integer('attempt_number').default(1).notNull(),

  /** 0.0 = perfect match, 1.0 = maximum deviation from master stroke */
  deviationScore: real('deviation_score'),

  /** 0.0 = no rhythm match, 1.0 = perfect timing */
  rhythmAccuracy: real('rhythm_accuracy'),

  /** Optional R2 key if apprentice chose to save their practice video */
  practiceVideoKey: text('practice_video_key'),

  durationSeconds: real('duration_seconds'),

  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
});
