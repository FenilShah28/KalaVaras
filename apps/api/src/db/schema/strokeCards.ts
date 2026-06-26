import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * ENUM definitions for stroke cards.
 */
export const traditionEnum = pgEnum('tradition', ['warli', 'kolam', 'pichwai', 'madhubani']);
export const visibilityEnum = pgEnum('visibility', ['private', 'community', 'public', 'research']);

/**
 * Stroke Cards table — Document 5 Section 5.1.
 *
 * Represents atomic motor vocabulary cards for each art tradition.
 * Each card is owned by an artisan (owner_id) and must pass ownership
 * checks before any read/update/delete operation.
 *
 * owner_id is explicitly set as a FK to users(id) — never rely on
 * implicit joins for ownership. Database-level NOT NULL constraint
 * ensures no content row can exist without a valid owner.
 */
export const strokeCards = pgTable('stroke_cards', {
  id: uuid('id').defaultRandom().primaryKey(),

  /**
   * Explicit ownership FK — every content table MUST have this.
   * NOT NULL enforced at database level: no card without an owner.
   */
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),

  /** Original artisan who created this technique documentation */
  artisanId: uuid('artisan_id').references(() => users.id, { onDelete: 'set null' }),

  tradition: traditionEnum('tradition').notNull(),
  nameMarathi: varchar('name_marathi', { length: 200 }).notNull(),
  nameEnglish: varchar('name_english', { length: 200 }),
  descriptionMarathi: text('description_marathi'),
  descriptionEnglish: text('description_english'),

  /** 1-5 difficulty rating */
  difficulty: smallint('difficulty'),

  /**
   * JSONB array of atomic motor units within this card.
   * Structure: [{unit_id: string, name: string, sequence_order: number}]
   */
  atomicUnits: jsonb('atomic_units'),

  visibility: visibilityEnum('visibility').default('community').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  viewCount: integer('view_count').default(0).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
