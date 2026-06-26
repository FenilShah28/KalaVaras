import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { extractRequestContext } from '../db/auditLog.service.js';
import { batchSyncSchema } from './sync.schemas.js';
import { processBatchSync } from '../services/sync.service.js';

const router = Router();

// All sync routes require authentication
router.use(authenticate);

// =====================================================================
// POST /api/v1/sync — Batch sync offline-queued actions
//
// Accepts up to 50 actions per call. Each action is processed
// sequentially. Failures are reported per-action without aborting
// the rest of the batch. Owner is always the authenticated user —
// prevents replay attacks with spoofed user IDs.
// =====================================================================
router.post(
  '/',
  validate({ body: batchSyncSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractRequestContext(req);
      const result = await processBatchSync(req.body, req.user!.userId, ctx);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
