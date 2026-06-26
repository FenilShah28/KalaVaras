import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../middleware/validation.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import { extractRequestContext } from '../db/auditLog.service.js';
import {
  createCardSchema,
  updateCardSchema,
  listCardsQuerySchema,
} from './cards.schemas.js';
import {
  createCard,
  getCardById,
  listCards,
  updateCard,
  deleteCard,
  publishCard,
} from '../services/cards.service.js';
import { commonSchemas } from '../middleware/validation.js';

const router = Router();

// =====================================================================
// GET /api/v1/cards — List cards (paginated, filtered)
// Public cards visible to all; private cards only to owner
// =====================================================================
router.get(
  '/',
  validate({ query: listCardsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Optional auth — don't require login for browsing public cards
      const requesterId = req.user?.userId;
      const result = await listCards(req.query as any, requesterId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// GET /api/v1/cards/:id — Get single card
// Visibility rules apply
// =====================================================================
router.get(
  '/:id',
  validate({ params: commonSchemas.idParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user?.userId;
      const card = await getCardById(req.params.id as string, requesterId);
      sendSuccess(res, { card });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/cards — Create a new stroke card
// Auth: artisan or admin only
// =====================================================================
router.post(
  '/',
  authenticate,
  requireRole('artisan', 'admin'),
  validate({ body: createCardSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractRequestContext(req);
      const card = await createCard(req.body, req.user!.userId, ctx);
      sendCreated(res, { card });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// PATCH /api/v1/cards/:id — Update a stroke card
// Auth: owner only (IDOR checked in service layer)
// =====================================================================
router.patch(
  '/:id',
  authenticate,
  validate({ params: commonSchemas.idParam, body: updateCardSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractRequestContext(req);
      const card = await updateCard(
        req.params.id as string,
        req.body,
        req.user!.userId,
        ctx,
      );
      sendSuccess(res, { card });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// DELETE /api/v1/cards/:id — Delete a stroke card
// Auth: owner or admin (IDOR checked in service layer)
// =====================================================================
router.delete(
  '/:id',
  authenticate,
  validate({ params: commonSchemas.idParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractRequestContext(req);
      await deleteCard(
        req.params.id as string,
        req.user!.userId,
        req.user!.role,
        ctx,
      );
      sendSuccess(res, { message: 'Stroke card deleted' });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/cards/:id/publish — Publish a stroke card
// Auth: owner only
// =====================================================================
router.post(
  '/:id/publish',
  authenticate,
  validate({ params: commonSchemas.idParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractRequestContext(req);
      const card = await publishCard(
        req.params.id as string,
        req.user!.userId,
        ctx,
      );
      sendSuccess(res, { card });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
