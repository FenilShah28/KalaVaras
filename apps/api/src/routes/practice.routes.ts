import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import { extractRequestContext } from '../db/auditLog.service.js';
import { commonSchemas } from '../middleware/validation.js';
import {
  submitPracticeSchema,
  listPracticeQuerySchema,
} from './practice.schemas.js';
import {
  submitPractice,
  listPracticeSessions,
  getProgressForCard,
  getProgressDashboard,
} from '../services/practice.service.js';

const router = Router();

// All practice routes require authentication
router.use(authenticate);

// =====================================================================
// POST /api/v1/practice — Submit a practice session
// =====================================================================
router.post(
  '/',
  validate({ body: submitPracticeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = extractRequestContext(req);
      const session = await submitPractice(req.body, req.user!.userId, ctx);
      sendCreated(res, { session });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// GET /api/v1/practice — List my practice sessions (paginated)
// =====================================================================
router.get(
  '/',
  validate({ query: listPracticeQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listPracticeSessions(req.query as any, req.user!.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// GET /api/v1/practice/dashboard — Overall progress summary
// =====================================================================
router.get(
  '/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboard = await getProgressDashboard(req.user!.userId);
      sendSuccess(res, dashboard);
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// GET /api/v1/practice/progress/:cardId — Progress for a specific card
// =====================================================================
router.get(
  '/progress/:id',
  validate({ params: commonSchemas.idParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const progress = await getProgressForCard(
        req.params.id as string,
        req.user!.userId,
      );
      sendSuccess(res, progress);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
