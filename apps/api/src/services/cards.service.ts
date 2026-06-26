import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { strokeCards } from '../db/schema/index.js';
import { writeAuditLog } from '../db/auditLog.service.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { CreateCardInput, UpdateCardInput, ListCardsQuery } from '../routes/cards.schemas.js';

// =====================================================================
// CREATE
// =====================================================================

export async function createCard(
  input: CreateCardInput,
  userId: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  const [card] = await db.insert(strokeCards).values({
    ownerId: userId,
    artisanId: userId,
    tradition: input.tradition,
    nameMarathi: input.nameMarathi,
    nameEnglish: input.nameEnglish ?? null,
    descriptionMarathi: input.descriptionMarathi ?? null,
    descriptionEnglish: input.descriptionEnglish ?? null,
    difficulty: input.difficulty ?? null,
    atomicUnits: input.atomicUnits ?? null,
    visibility: input.visibility,
  }).returning();

  await writeAuditLog({
    userId,
    action: 'card:created',
    resourceType: 'stroke_card',
    resourceId: card!.id,
    ...reqContext,
  });

  logger.info('Stroke card created', { cardId: card!.id, userId, tradition: input.tradition });

  return card!;
}

// =====================================================================
// GET BY ID (with visibility + ownership checks)
// =====================================================================

export async function getCardById(cardId: string, requesterId?: string) {
  const [card] = await db.select().from(strokeCards).where(eq(strokeCards.id, cardId)).limit(1);

  if (!card) {
    throw new NotFoundError('Stroke card not found');
  }

  // Visibility access rules:
  // - private: owner only
  // - community/public/research: anyone authenticated
  if (card.visibility === 'private' && card.ownerId !== requesterId) {
    throw new NotFoundError('Stroke card not found'); // Don't reveal existence
  }

  // Increment view count (fire-and-forget, non-blocking)
  db.update(strokeCards)
    .set({ viewCount: sql`${strokeCards.viewCount} + 1` })
    .where(eq(strokeCards.id, cardId))
    .catch(() => {}); // Swallow errors — view count is non-critical

  return card;
}

// =====================================================================
// LIST (with filtering and pagination)
// =====================================================================

export async function listCards(query: ListCardsQuery, requesterId?: string) {
  const { page, limit, tradition, difficulty, visibility, search, ownerId } = query;
  const offset = (page - 1) * limit;

  // Build dynamic WHERE conditions
  const conditions = [];

  // Only show cards the requester has access to
  if (requesterId) {
    // Authenticated: show own private + all community/public/research
    conditions.push(
      sql`(${strokeCards.visibility} != 'private' OR ${strokeCards.ownerId} = ${requesterId})`,
    );
  } else {
    // Unauthenticated: only public cards
    conditions.push(eq(strokeCards.visibility, 'public'));
  }

  if (tradition) conditions.push(eq(strokeCards.tradition, tradition));
  if (difficulty) conditions.push(eq(strokeCards.difficulty, difficulty));
  if (visibility) conditions.push(eq(strokeCards.visibility, visibility));
  if (ownerId) conditions.push(eq(strokeCards.ownerId, ownerId));
  if (search) {
    conditions.push(
      sql`(${strokeCards.nameMarathi} ILIKE ${'%' + search + '%'} OR ${strokeCards.nameEnglish} ILIKE ${'%' + search + '%'})`,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [cards, countResult] = await Promise.all([
    db.select()
      .from(strokeCards)
      .where(whereClause)
      .orderBy(desc(strokeCards.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(strokeCards)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    cards,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// =====================================================================
// UPDATE (ownership required)
// =====================================================================

export async function updateCard(
  cardId: string,
  input: UpdateCardInput,
  userId: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  // Fetch first, then check ownership (IDOR prevention pattern)
  const [card] = await db.select({
    id: strokeCards.id,
    ownerId: strokeCards.ownerId,
  }).from(strokeCards).where(eq(strokeCards.id, cardId)).limit(1);

  if (!card) {
    throw new NotFoundError('Stroke card not found');
  }

  if (card.ownerId !== userId) {
    // Log IDOR attempt and return 404 (not 403)
    await writeAuditLog({
      userId,
      action: 'idor:attempt',
      resourceType: 'stroke_card',
      resourceId: cardId,
      details: `User ${userId} attempted to update card owned by ${card.ownerId}`,
      ...reqContext,
    });
    throw new NotFoundError('Stroke card not found');
  }

  const updateData: Record<string, unknown> = {};
  if (input.nameMarathi !== undefined) updateData.nameMarathi = input.nameMarathi;
  if (input.nameEnglish !== undefined) updateData.nameEnglish = input.nameEnglish;
  if (input.descriptionMarathi !== undefined) updateData.descriptionMarathi = input.descriptionMarathi;
  if (input.descriptionEnglish !== undefined) updateData.descriptionEnglish = input.descriptionEnglish;
  if (input.difficulty !== undefined) updateData.difficulty = input.difficulty;
  if (input.atomicUnits !== undefined) updateData.atomicUnits = input.atomicUnits;
  if (input.visibility !== undefined) updateData.visibility = input.visibility;

  const [updated] = await db.update(strokeCards)
    .set(updateData)
    .where(eq(strokeCards.id, cardId))
    .returning();

  await writeAuditLog({
    userId,
    action: 'card:updated',
    resourceType: 'stroke_card',
    resourceId: cardId,
    details: `Fields updated: ${Object.keys(updateData).join(', ')}`,
    ...reqContext,
  });

  logger.info('Stroke card updated', { cardId, userId });

  return updated;
}

// =====================================================================
// DELETE (ownership required)
// =====================================================================

export async function deleteCard(
  cardId: string,
  userId: string,
  userRole: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  const [card] = await db.select({
    id: strokeCards.id,
    ownerId: strokeCards.ownerId,
  }).from(strokeCards).where(eq(strokeCards.id, cardId)).limit(1);

  if (!card) {
    throw new NotFoundError('Stroke card not found');
  }

  // Owner or admin can delete
  if (card.ownerId !== userId && userRole !== 'admin') {
    await writeAuditLog({
      userId,
      action: 'idor:attempt',
      resourceType: 'stroke_card',
      resourceId: cardId,
      details: `User ${userId} attempted to delete card owned by ${card.ownerId}`,
      ...reqContext,
    });
    throw new NotFoundError('Stroke card not found');
  }

  // CASCADE: media_assets are deleted automatically via FK
  await db.delete(strokeCards).where(eq(strokeCards.id, cardId));

  await writeAuditLog({
    userId,
    action: 'card:deleted',
    resourceType: 'stroke_card',
    resourceId: cardId,
    ...reqContext,
  });

  logger.info('Stroke card deleted', { cardId, userId });

  return { deleted: true };
}

// =====================================================================
// PUBLISH (set visibility to public + add publishedAt timestamp)
// =====================================================================

export async function publishCard(
  cardId: string,
  userId: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  const [card] = await db.select({
    id: strokeCards.id,
    ownerId: strokeCards.ownerId,
  }).from(strokeCards).where(eq(strokeCards.id, cardId)).limit(1);

  if (!card) {
    throw new NotFoundError('Stroke card not found');
  }

  if (card.ownerId !== userId) {
    throw new NotFoundError('Stroke card not found');
  }

  const [published] = await db.update(strokeCards).set({
    visibility: 'public',
    publishedAt: new Date(),
  }).where(eq(strokeCards.id, cardId)).returning();

  await writeAuditLog({
    userId,
    action: 'card:published',
    resourceType: 'stroke_card',
    resourceId: cardId,
    ...reqContext,
  });

  logger.info('Stroke card published', { cardId, userId });

  return published;
}
