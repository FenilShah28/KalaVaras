import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { syncQueue } from '../db/schema/index.js';
import { writeAuditLog } from '../db/auditLog.service.js';
import { logger } from '../utils/logger.js';
import { submitPractice } from './practice.service.js';
import { publishCard } from './cards.service.js';
import type { BatchSyncInput, SyncAction } from '../routes/sync.schemas.js';

/**
 * Result for a single sync action — success or failure with detail.
 */
interface ActionResult {
  actionType: string;
  status: 'success' | 'failed';
  error?: string;
  data?: unknown;
}

// =====================================================================
// PROCESS A SINGLE ACTION
// =====================================================================

async function processAction(
  action: SyncAction,
  userId: string,
  reqContext: { ipAddress: string; userAgent: string },
): Promise<ActionResult> {
  try {
    if (action.actionType === 'submit_practice') {
      const session = await submitPractice(action.payload, userId, reqContext);
      return { actionType: action.actionType, status: 'success', data: { sessionId: session.id } };
    }

    if (action.actionType === 'publish_card') {
      const card = await publishCard(action.payload.cardId, userId, reqContext);
      return { actionType: action.actionType, status: 'success', data: { cardId: card?.id } };
    }

    if (action.actionType === 'upload_video') {
      // Decode base64 to buffer for upload pipeline
      const buffer = Buffer.from(action.payload.fileBase64, 'base64');
      // Dynamic import to avoid circular dependency with upload middleware
      const { uploadMedia } = await import('./media.service.js');
      const asset = await uploadMedia(
        {
          strokeCardId: action.payload.strokeCardId,
          type: action.payload.mediaType,
          file: { buffer, mimetype: action.payload.mimeType, size: buffer.length },
        },
        userId,
        reqContext,
      );
      return { actionType: action.actionType, status: 'success', data: { assetId: asset.id } };
    }

    return { actionType: 'unknown', status: 'failed', error: 'Unknown action type' };
  } catch (error) {
    logger.warn('Sync action failed', {
      actionType: action.actionType,
      userId,
      error: (error as Error).message,
    });
    return {
      actionType: action.actionType,
      status: 'failed',
      error: (error as Error).message,
    };
  }
}

// =====================================================================
// BATCH SYNC — process all queued actions, log to DB
// =====================================================================

export async function processBatchSync(
  input: BatchSyncInput,
  userId: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  const results: ActionResult[] = [];

  for (const action of input.actions) {
    // Write action to sync_queue as 'syncing'
    const [queueEntry] = await db.insert(syncQueue).values({
      ownerId: userId,
      userId,
      actionType: action.actionType,
      payload: action.payload as Record<string, unknown>,
      status: 'syncing',
      createdOfflineAt: action.createdOfflineAt ? new Date(action.createdOfflineAt) : null,
    }).returning({ id: syncQueue.id });

    // Process the action
    const result = await processAction(action, userId, reqContext);

    // Update queue entry with result
    await db.update(syncQueue).set({
      status: result.status === 'success' ? 'done' : 'failed',
      syncedAt: result.status === 'success' ? new Date() : null,
    }).where(eq(syncQueue.id, queueEntry!.id));

    results.push(result);
  }

  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  await writeAuditLog({
    userId,
    action: 'sync:batch',
    details: `${succeeded} succeeded, ${failed} failed out of ${input.actions.length}`,
    ...reqContext,
  });

  logger.info('Batch sync completed', { userId, succeeded, failed, total: input.actions.length });

  return { results, succeeded, failed, total: input.actions.length };
}
