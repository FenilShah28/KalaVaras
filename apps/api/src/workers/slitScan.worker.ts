import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { mediaAssets } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getIO } from '../config/socket.js';
import type { SlitScanJobData } from '../config/queue.js';
import { redis } from '../config/redis.js';

/**
 * Slit-scan worker — processes source_video assets.
 */

export let slitScanWorker: Worker<SlitScanJobData> | null = null;

if (!env.USE_LOCAL_MOCKS) {
  const connection = {
    host: new URL(env.REDIS_URL).hostname,
    port: Number(new URL(env.REDIS_URL).port) || 6379,
    password: new URL(env.REDIS_URL).password || undefined,
  };

  slitScanWorker = new Worker<SlitScanJobData>(
    'slit-scan',
    async (job: Job<SlitScanJobData>) => {
      const { assetId, strokeCardId, userId, storageKey, mimeType } = job.data;
      const io = getIO();

      logger.info('Slit-scan job started', { jobId: job.id, assetId });

      await db.update(mediaAssets)
        .set({ processingStatus: 'processing' })
        .where(eq(mediaAssets.id, assetId));

      io.to(`user:${userId}`).emit('processing:status', {
        assetId,
        strokeCardId,
        status: 'processing',
        progress: 10,
      });

      await job.updateProgress(10);

      const response = await fetch(`${env.SLIT_SCAN_SERVICE_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': env.INTERNAL_SERVICE_SECRET,
        },
        body: JSON.stringify({
          asset_id: assetId,
          storage_key: storageKey,
          stroke_card_id: strokeCardId,
          mime_type: mimeType,
        }),
        signal: AbortSignal.timeout(120_000), // 2-minute timeout
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Slit-scan service returned ${response.status}: ${err}`);
      }

      const result = await response.json() as {
        slit_scan_key?: string;
        rhythm_waveform_key?: string;
      };

      await job.updateProgress(70);

      io.to(`user:${userId}`).emit('processing:status', {
        assetId,
        strokeCardId,
        status: 'processing',
        progress: 70,
      });

      const insertions = [];

      if (result.slit_scan_key) {
        insertions.push(
          db.insert(mediaAssets).values({
            ownerId: userId,
            strokeCardId,
            type: 'slit_scan',
            storageKey: result.slit_scan_key,
            url: `${env.R2_PUBLIC_URL}/${result.slit_scan_key}`,
            processingStatus: 'complete',
          }),
        );
      }

      if (result.rhythm_waveform_key) {
        insertions.push(
          db.insert(mediaAssets).values({
            ownerId: userId,
            strokeCardId,
            type: 'rhythm_waveform',
            storageKey: result.rhythm_waveform_key,
            url: `${env.R2_PUBLIC_URL}/${result.rhythm_waveform_key}`,
            processingStatus: 'complete',
          }),
        );
      }

      if (insertions.length > 0) {
        await Promise.all(insertions);
      }

      await db.update(mediaAssets)
        .set({ processingStatus: 'complete' })
        .where(eq(mediaAssets.id, assetId));

      await job.updateProgress(100);

      io.to(`user:${userId}`).emit('processing:status', {
        assetId,
        strokeCardId,
        status: 'complete',
        progress: 100,
        slitScanUrl: result.slit_scan_key ? `${env.R2_PUBLIC_URL}/${result.slit_scan_key}` : null,
        rhythmWaveformUrl: result.rhythm_waveform_key ? `${env.R2_PUBLIC_URL}/${result.rhythm_waveform_key}` : null,
      });

      logger.info('Slit-scan job complete', { jobId: job.id, assetId });
    },
    {
      connection,
      concurrency: 3,
    },
  );

  slitScanWorker.on('failed', async (job, err) => {
    if (!job) return;
    const { assetId, strokeCardId, userId } = job.data;

    logger.error('Slit-scan job failed', {
      jobId: job.id,
      assetId,
      error: err.message,
      attempts: job.attemptsMade,
    });

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await db.update(mediaAssets)
        .set({ processingStatus: 'failed' })
        .where(eq(mediaAssets.id, assetId));

      const io = getIO();
      io.to(`user:${userId}`).emit('processing:status', {
        assetId,
        strokeCardId,
        status: 'failed',
        error: err.message,
      });
    }
  });

  slitScanWorker.on('error', (err) => {
    logger.error('Slit-scan worker error', { error: err.message });
  });
}
