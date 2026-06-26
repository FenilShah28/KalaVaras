import { eq, and, desc, sql, count } from 'drizzle-orm';
import { db } from '../config/database.js';
import { practiceSessions, strokeCards } from '../db/schema/index.js';
import { writeAuditLog } from '../db/auditLog.service.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { SubmitPracticeInput, ListPracticeQuery } from '../routes/practice.schemas.js';

// =====================================================================
// SUBMIT PRACTICE SESSION
// =====================================================================

export async function submitPractice(
  input: SubmitPracticeInput,
  userId: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  // Verify card exists and is accessible
  const [card] = await db.select({
    id: strokeCards.id,
    visibility: strokeCards.visibility,
    ownerId: strokeCards.ownerId,
  }).from(strokeCards).where(eq(strokeCards.id, input.strokeCardId)).limit(1);

  if (!card) throw new NotFoundError('Stroke card not found');

  // Private cards: only owner can practice (prevents data leakage via practice records)
  if (card.visibility === 'private' && card.ownerId !== userId) {
    throw new NotFoundError('Stroke card not found');
  }

  // Get attempt number (how many times this user has practised this card)
  const [attemptResult] = await db
    .select({ attempts: count() })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.ownerId, userId),
        eq(practiceSessions.strokeCardId, input.strokeCardId),
      ),
    );

  const attemptNumber = (attemptResult?.attempts ?? 0) + 1;

  const [session] = await db.insert(practiceSessions).values({
    ownerId: userId,
    apprenticeId: userId,
    strokeCardId: input.strokeCardId,
    attemptNumber,
    deviationScore: input.deviationScore ?? null,
    rhythmAccuracy: input.rhythmAccuracy ?? null,
    durationSeconds: input.durationSeconds ?? null,
    practiceVideoKey: input.practiceVideoKey ?? null,
  }).returning();

  await writeAuditLog({
    userId,
    action: 'practice:submitted',
    resourceType: 'practice_session',
    resourceId: session!.id,
    details: `Card: ${input.strokeCardId}, Attempt #${attemptNumber}`,
    ...reqContext,
  });

  logger.info('Practice session submitted', {
    sessionId: session!.id,
    userId,
    cardId: input.strokeCardId,
    attemptNumber,
  });

  return session!;
}

// =====================================================================
// LIST PRACTICE SESSIONS (user's own)
// =====================================================================

export async function listPracticeSessions(
  query: ListPracticeQuery,
  userId: string,
) {
  const { page, limit, strokeCardId } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(practiceSessions.ownerId, userId)];
  if (strokeCardId) conditions.push(eq(practiceSessions.strokeCardId, strokeCardId));

  const whereClause = and(...conditions);

  const [sessions, countResult] = await Promise.all([
    db.select()
      .from(practiceSessions)
      .where(whereClause)
      .orderBy(desc(practiceSessions.completedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() })
      .from(practiceSessions)
      .where(whereClause),
  ]);

  return {
    sessions,
    pagination: {
      page,
      limit,
      total: countResult[0]?.total ?? 0,
      totalPages: Math.ceil((countResult[0]?.total ?? 0) / limit),
    },
  };
}

// =====================================================================
// PROGRESS SUMMARY — per card stats for a user
// =====================================================================

export async function getProgressForCard(strokeCardId: string, userId: string) {
  const [card] = await db.select({ id: strokeCards.id })
    .from(strokeCards)
    .where(eq(strokeCards.id, strokeCardId))
    .limit(1);

  if (!card) throw new NotFoundError('Stroke card not found');

  const sessions = await db.select({
    attemptNumber: practiceSessions.attemptNumber,
    deviationScore: practiceSessions.deviationScore,
    rhythmAccuracy: practiceSessions.rhythmAccuracy,
    completedAt: practiceSessions.completedAt,
  })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.ownerId, userId),
        eq(practiceSessions.strokeCardId, strokeCardId),
      ),
    )
    .orderBy(desc(practiceSessions.completedAt));

  if (sessions.length === 0) {
    return { totalAttempts: 0, bestDeviation: null, latestRhythm: null, trend: [] };
  }

  const withScores = sessions.filter(s => s.deviationScore !== null);
  const bestDeviation = withScores.length > 0
    ? Math.min(...withScores.map(s => s.deviationScore!))
    : null;

  const latestRhythm = sessions[0]?.rhythmAccuracy ?? null;

  // Trend: last 10 sessions with scores (for sparkline charts)
  const trend = sessions
    .slice(0, 10)
    .map(s => ({
      attempt: s.attemptNumber,
      deviation: s.deviationScore,
      rhythm: s.rhythmAccuracy,
      date: s.completedAt,
    }))
    .reverse();

  return {
    totalAttempts: sessions.length,
    bestDeviation,
    latestRhythm,
    trend,
  };
}

// =====================================================================
// STREAK — consecutive days with at least one practice session
// =====================================================================

export async function getUserStreak(userId: string) {
  // Get distinct practice dates ordered descending
  const rows = await db.selectDistinct({
    day: sql<string>`DATE(${practiceSessions.completedAt} AT TIME ZONE 'Asia/Kolkata')`,
  })
    .from(practiceSessions)
    .where(eq(practiceSessions.ownerId, userId))
    .orderBy(desc(sql`DATE(${practiceSessions.completedAt} AT TIME ZONE 'Asia/Kolkata')`));

  if (rows.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Calculate current streak from today backward
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const dates = rows.map(r => new Date(r.day));

  // Check if user practised today or yesterday (grace period)
  const daysSinceLastPractice = Math.floor(
    (today.getTime() - dates[0]!.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceLastPractice <= 1) {
    currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const diff = Math.floor(
        (dates[i - 1]!.getTime() - dates[i]!.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.floor(
      (dates[i - 1]!.getTime() - dates[i]!.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}

// =====================================================================
// OVERALL PROGRESS DASHBOARD — cards attempted, best scores, streak
// =====================================================================

export async function getProgressDashboard(userId: string) {
  const [streak, cardsAttempted] = await Promise.all([
    getUserStreak(userId),
    db.selectDistinct({ cardId: practiceSessions.strokeCardId })
      .from(practiceSessions)
      .where(eq(practiceSessions.ownerId, userId)),
  ]);

  const totalSessions = await db
    .select({ total: count() })
    .from(practiceSessions)
    .where(eq(practiceSessions.ownerId, userId));

  return {
    totalSessions: totalSessions[0]?.total ?? 0,
    cardsAttempted: cardsAttempted.length,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
  };
}
