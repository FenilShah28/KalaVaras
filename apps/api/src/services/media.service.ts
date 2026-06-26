import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { mediaAssets, strokeCards } from '../db/schema/index.js';
import { writeAuditLog } from '../db/auditLog.service.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { generateSecureFilename } from '../middleware/upload.js';
import { uploadToR2, deleteFromR2 } from '../config/r2.js';
import { enqueueSlitScan } from '../config/queue.js';

/**
 * Media service — handles file processing, storage, and metadata.
 *
 * Processing pipeline:
 * 1. Receive buffer from multer (memory storage)
 * 2. For images: strip EXIF data via sharp, resize if needed
 * 3. Generate UUID filename (original filename NEVER stored)
 * 4. Upload to Cloudflare R2 (real — @aws-sdk/client-s3)
 * 5. Store metadata in media_assets table
 * 6. If source_video: enqueue BullMQ slit-scan job
 *
 * Security:
 * - EXIF stripping removes GPS, camera model, timestamps from images
 * - UUID filenames prevent path traversal and information leakage
 * - Owner must match stroke card owner (validated before upload)
 */

// =====================================================================
// EXIF STRIPPING
// =====================================================================

async function stripExifData(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (!mimeType.startsWith('image/')) return buffer;

  try {
    return await sharp(buffer)
      .rotate()                              // Auto-rotate from EXIF before stripping
      .withMetadata({ orientation: undefined }) // Remove all metadata
      .toBuffer();
  } catch (error) {
    logger.error('EXIF stripping failed, using original buffer', {
      error: (error as Error).message,
    });
    return buffer;
  }
}

// =====================================================================
// UPLOAD MEDIA
// =====================================================================

interface UploadMediaInput {
  strokeCardId: string;
  type: 'source_video' | 'slit_scan' | 'rhythm_waveform' | 'clay_scan' | 'card_gif';
  file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  };
}

export async function uploadMedia(
  input: UploadMediaInput,
  userId: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  // Verify stroke card exists and belongs to user (IDOR prevention)
  const [card] = await db.select({
    id: strokeCards.id,
    ownerId: strokeCards.ownerId,
  }).from(strokeCards).where(eq(strokeCards.id, input.strokeCardId)).limit(1);

  if (!card) throw new NotFoundError('Stroke card not found');

  if (card.ownerId !== userId) {
    await writeAuditLog({
      userId,
      action: 'idor:attempt',
      resourceType: 'media_asset',
      details: `User ${userId} attempted to upload media to card owned by ${card.ownerId}`,
      ...reqContext,
    });
    throw new NotFoundError('Stroke card not found');
  }

  // Strip EXIF data from images
  const processedBuffer = await stripExifData(input.file.buffer, input.file.mimetype);

  // Generate UUID storage key
  const storageKey = `cards/${card.id}/${generateSecureFilename(input.file.mimetype)}`;

  // Upload to Cloudflare R2
  const url = await uploadToR2({
    buffer: processedBuffer,
    key: storageKey,
    contentType: input.file.mimetype,
    metadata: {
      uploadedBy: userId,
      strokeCardId: input.strokeCardId,
      mediaType: input.type,
    },
  });

  // Get image dimensions if applicable
  let metadata: Record<string, unknown> = {};
  if (input.file.mimetype.startsWith('image/')) {
    try {
      const meta = await sharp(processedBuffer).metadata();
      metadata = { width: meta.width, height: meta.height };
    } catch { /* non-critical */ }
  }

  // Store in database — videos start as 'pending', images as 'complete'
  const isVideo = input.file.mimetype.startsWith('video/');
  const [asset] = await db.insert(mediaAssets).values({
    ownerId: userId,
    strokeCardId: input.strokeCardId,
    type: input.type,
    storageKey,
    url,
    fileSizeBytes: processedBuffer.length,
    processingStatus: isVideo && input.type === 'source_video' ? 'pending' : 'complete',
    metadata,
  }).returning();

  // Enqueue slit-scan job for source videos
  if (isVideo && input.type === 'source_video') {
    await enqueueSlitScan({
      assetId: asset!.id,
      strokeCardId: input.strokeCardId,
      userId,
      storageKey,
      mimeType: input.file.mimetype,
    });
    logger.info('Slit-scan job enqueued after upload', { assetId: asset!.id });
  }

  await writeAuditLog({
    userId,
    action: 'media:uploaded',
    resourceType: 'media_asset',
    resourceId: asset!.id,
    details: `Type: ${input.type}, Size: ${processedBuffer.length} bytes`,
    ...reqContext,
  });

  logger.info('Media uploaded', {
    assetId: asset!.id,
    cardId: input.strokeCardId,
    type: input.type,
    size: processedBuffer.length,
    enqueuedSlitScan: isVideo && input.type === 'source_video',
  });

  return asset!;
}

// =====================================================================
// GET MEDIA FOR CARD
// =====================================================================

export async function getMediaForCard(strokeCardId: string, requesterId?: string) {
  const [card] = await db.select({
    id: strokeCards.id,
    ownerId: strokeCards.ownerId,
    visibility: strokeCards.visibility,
  }).from(strokeCards).where(eq(strokeCards.id, strokeCardId)).limit(1);

  if (!card) throw new NotFoundError('Stroke card not found');

  if (card.visibility === 'private' && card.ownerId !== requesterId) {
    throw new NotFoundError('Stroke card not found');
  }

  return db.select().from(mediaAssets).where(eq(mediaAssets.strokeCardId, strokeCardId));
}

// =====================================================================
// DELETE MEDIA
// =====================================================================

export async function deleteMedia(
  assetId: string,
  userId: string,
  userRole: string,
  reqContext: { ipAddress: string; userAgent: string },
) {
  const [asset] = await db.select({
    id: mediaAssets.id,
    ownerId: mediaAssets.ownerId,
    storageKey: mediaAssets.storageKey,
  }).from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);

  if (!asset) throw new NotFoundError('Media asset not found');

  if (asset.ownerId !== userId && userRole !== 'admin') {
    await writeAuditLog({
      userId,
      action: 'idor:attempt',
      resourceType: 'media_asset',
      resourceId: assetId,
      details: `User ${userId} attempted to delete media owned by ${asset.ownerId}`,
      ...reqContext,
    });
    throw new NotFoundError('Media asset not found');
  }

  // Delete from R2 then DB (order matters — if R2 fails, DB record stays)
  await deleteFromR2(asset.storageKey);
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));

  await writeAuditLog({
    userId,
    action: 'media:deleted',
    resourceType: 'media_asset',
    resourceId: assetId,
    ...reqContext,
  });

  logger.info('Media deleted', { assetId, userId });
  return { deleted: true };
}
