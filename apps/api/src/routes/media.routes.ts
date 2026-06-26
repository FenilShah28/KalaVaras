import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import { extractRequestContext } from '../db/auditLog.service.js';
import { BadRequestError } from '../utils/errors.js';
import { commonSchemas } from '../middleware/validation.js';
import {
  uploadMedia,
  getMediaForCard,
  deleteMedia,
} from '../services/media.service.js';

const router = Router();

/** Valid media types for upload */
const mediaTypeValues = ['source_video', 'slit_scan', 'rhythm_waveform', 'clay_scan', 'card_gif'] as const;

const uploadBodySchema = z.object({
  strokeCardId: z.string().uuid('Invalid stroke card ID'),
  type: z.enum(mediaTypeValues, {
    errorMap: () => ({
      message: `Type must be one of: ${mediaTypeValues.join(', ')}`,
    }),
  }),
});

// =====================================================================
// POST /api/v1/media — Upload a media file
// Auth: required
// Rate: 10/min (uploadLimiter)
// File: single, max 5MB, MIME whitelist
// =====================================================================
router.post(
  '/',
  authenticate,
  uploadLimiter,
  uploadSingle,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body fields (multer parses multipart, so body comes from form fields)
      const parsed = uploadBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          `Validation failed: ${parsed.error.errors.map(e => e.message).join('; ')}`,
        );
      }

      if (!req.file) {
        throw new BadRequestError('No file provided');
      }

      const ctx = extractRequestContext(req);
      const asset = await uploadMedia(
        {
          strokeCardId: parsed.data.strokeCardId,
          type: parsed.data.type,
          file: {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            size: req.file.size,
          },
        },
        req.user!.userId,
        ctx,
      );

      sendCreated(res, { asset });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// GET /api/v1/media/card/:id — Get all media for a stroke card
// Visibility rules apply (checked in service)
// =====================================================================
router.get(
  '/card/:id',
  validate({ params: commonSchemas.idParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.userId;
      const assets = await getMediaForCard(req.params.id as string, requesterId);
      sendSuccess(res, { assets });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// DELETE /api/v1/media/:id — Delete a media asset
// Auth: owner or admin
// =====================================================================
router.delete(
  '/:id',
  authenticate,
  validate({ params: commonSchemas.idParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractRequestContext(req);
      await deleteMedia(
        req.params.id as string,
        req.user!.userId,
        req.user!.role,
        ctx,
      );
      sendSuccess(res, { message: 'Media asset deleted' });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
