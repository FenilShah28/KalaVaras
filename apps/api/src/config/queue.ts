import { Queue, Job } from 'bullmq';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { redis } from './redis.js';

const connection = redis;

// =====================================================================
// QUEUE DEFINITIONS
// =====================================================================

let slitScanQueue: any;
let emailQueue: any;

if (env.USE_LOCAL_MOCKS) {
  const mockQueue = {
    add: async (name: string, data: any, opts?: any) => {
      logger.info(`[Mock Queue] Job added to queue: ${name}`, { data, opts });
      return { id: `mock-job-${Date.now()}` };
    },
    close: async () => {
      logger.info('[Mock Queue] Closed');
    },
  };
  slitScanQueue = mockQueue;
  emailQueue = mockQueue;
} else {
  slitScanQueue = new Queue('slit-scan', {
    connection: connection as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  emailQueue = new Queue('email', {
    connection: connection as any,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    },
  });
}

export { slitScanQueue, emailQueue };

// =====================================================================
// JOB TYPES
// =====================================================================

export interface SlitScanJobData {
  assetId: string;
  strokeCardId: string;
  userId: string;
  storageKey: string;
  mimeType: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  templateId: 'verify_email' | 'reset_password' | 'welcome';
  variables: Record<string, string>;
}

// =====================================================================
// JOB PRODUCERS
// =====================================================================

/**
 * Enqueue a slit-scan processing job.
 * Called immediately after a source_video is uploaded to R2.
 */
export async function enqueueSlitScan(data: SlitScanJobData): Promise<string> {
  if (env.USE_LOCAL_MOCKS) {
    const jobId = `mock-slit-scan:${data.assetId}`;
    logger.info('Enqueuing mock slit-scan job', { jobId, assetId: data.assetId });

    // Simulate async slit-scan processing in background
    setTimeout(async () => {
      try {
        const { assetId, strokeCardId, userId, storageKey } = data;
        const { getIO } = await import('./socket.js');
        const { db } = await import('./database.js');
        const { mediaAssets } = await import('../db/schema/index.js');
        const { eq } = await import('drizzle-orm');
        const io = getIO();

        logger.info('[Mock Worker] Slit-scan started', { assetId });

        // Update to 'processing'
        await db.update(mediaAssets)
          .set({ processingStatus: 'processing' })
          .where(eq(mediaAssets.id, assetId));

        io.to(`user:${userId}`).emit('processing:status', {
          assetId,
          strokeCardId,
          status: 'processing',
          progress: 10,
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        io.to(`user:${userId}`).emit('processing:status', {
          assetId,
          strokeCardId,
          status: 'processing',
          progress: 70,
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // Insert mock slit-scan and rhythm-waveform assets
        const slitScanKey = `slit_scan_${storageKey}`;
        const waveformKey = `waveform_${storageKey}`;

        await db.insert(mediaAssets).values({
          ownerId: userId,
          strokeCardId,
          type: 'slit_scan',
          storageKey: slitScanKey,
          url: `${env.R2_PUBLIC_URL}/${slitScanKey}`,
          processingStatus: 'complete',
        });

        await db.insert(mediaAssets).values({
          ownerId: userId,
          strokeCardId,
          type: 'rhythm_waveform',
          storageKey: waveformKey,
          url: `${env.R2_PUBLIC_URL}/${waveformKey}`,
          processingStatus: 'complete',
        });

        await db.update(mediaAssets)
          .set({ processingStatus: 'complete' })
          .where(eq(mediaAssets.id, assetId));

        io.to(`user:${userId}`).emit('processing:status', {
          assetId,
          strokeCardId,
          status: 'complete',
          progress: 100,
          slitScanUrl: `${env.R2_PUBLIC_URL}/${slitScanKey}`,
          rhythmWaveformUrl: `${env.R2_PUBLIC_URL}/${waveformKey}`,
        });

        logger.info('[Mock Worker] Slit-scan complete', { assetId });
      } catch (err: any) {
        logger.error('[Mock Worker] Error processing mock slit-scan job', { error: err.message });
      }
    }, 500);

    return jobId;
  }

  const job = await slitScanQueue.add('process', data, {
    jobId: `slit-scan:${data.assetId}`,
  });
  logger.info('Slit-scan job enqueued', { jobId: job.id, assetId: data.assetId });
  return job.id!;
}

/**
 * Enqueue an email delivery job.
 */
export async function enqueueEmail(data: EmailJobData): Promise<string> {
  if (env.USE_LOCAL_MOCKS) {
    const jobId = `mock-email:${Date.now()}`;
    logger.info('[Mock Email Queue] Email job enqueued', { jobId, to: data.to, template: data.templateId, variables: data.variables });
    return jobId;
  }

  const job = await emailQueue.add('send', data);
  logger.info('Email job enqueued', { jobId: job.id, to: data.to, template: data.templateId });
  return job.id!;
}

// =====================================================================
// JOB STATUS QUERY
// =====================================================================

/**
 * Get the current status of a slit-scan job by asset ID.
 * Used by the WebSocket handler to push real-time updates.
 */
export async function getJobStatus(assetId: string) {
  if (env.USE_LOCAL_MOCKS) {
    return { status: 'completed', progress: 100 };
  }

  const job = await Job.fromId(slitScanQueue, `slit-scan:${assetId}`);
  if (!job) return { status: 'not_found' };

  const state = await job.getState();
  const progress = job.progress;

  return { status: state, progress, failedReason: job.failedReason };
}

// =====================================================================
// GRACEFUL SHUTDOWN
// =====================================================================

export async function closeQueues() {
  await slitScanQueue.close();
  await emailQueue.close();
  logger.info('BullMQ queues closed');
}
