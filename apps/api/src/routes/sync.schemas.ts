import { z } from 'zod';

/**
 * Sync queue schemas — offline batch action submission.
 *
 * Clients queue actions when offline (via Dexie/IndexedDB) and POST
 * them in a batch when connectivity is restored. The server processes
 * each action sequentially, validating ownership per action.
 */


/** Individual sync action — mirrors the sync_queue DB row */
const syncActionSchema = z.discriminatedUnion('actionType', [
  z.object({
    actionType: z.literal('submit_practice'),
    payload: z.object({
      strokeCardId: z.string().uuid(),
      deviationScore: z.number().min(0).max(1).optional(),
      rhythmAccuracy: z.number().min(0).max(1).optional(),
      durationSeconds: z.number().positive().max(3600).optional(),
    }),
    createdOfflineAt: z.string().datetime().optional(),
  }),
  z.object({
    actionType: z.literal('publish_card'),
    payload: z.object({
      cardId: z.string().uuid(),
    }),
    createdOfflineAt: z.string().datetime().optional(),
  }),
  z.object({
    actionType: z.literal('upload_video'),
    payload: z.object({
      strokeCardId: z.string().uuid(),
      mediaType: z.enum(['source_video', 'slit_scan', 'rhythm_waveform', 'clay_scan', 'card_gif']),
      /** Base64-encoded file — max 5MB → ~6.7MB base64 */
      fileBase64: z.string().max(7_000_000, 'File too large for sync (max 5MB)'),
      mimeType: z.enum(['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']),
    }),
    createdOfflineAt: z.string().datetime().optional(),
  }),
]);

/** Batch sync request — up to 50 queued actions per call */
export const batchSyncSchema = z.object({
  actions: z
    .array(syncActionSchema)
    .min(1, 'At least one action is required')
    .max(50, 'Maximum 50 actions per sync batch'),
});

export type SyncAction = z.infer<typeof syncActionSchema>;
export type BatchSyncInput = z.infer<typeof batchSyncSchema>;
