import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, accountCreationLimiter } from '../middleware/rateLimiter.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
} from './auth.schemas.js';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  getCurrentUser,
} from '../services/auth.service.js';

const router = Router();

/**
 * Refresh token cookie configuration.
 * httpOnly: true — JavaScript cannot access (XSS protection)
 * secure: true in production — HTTPS only
 * sameSite: strict — CSRF protection
 * path: /api/v1/auth — only sent on auth endpoints
 * maxAge: 7 days
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// =====================================================================
// POST /api/v1/auth/register
// Rate: 3 per hour per IP (accountCreationLimiter)
// =====================================================================
router.post(
  '/register',
  accountCreationLimiter,
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerUser(req.body, req);
      sendCreated(res, {
        user: result.user,
        // In dev mode, include token for testing; production sends email
        ...(env.NODE_ENV !== 'production' && { verificationToken: result.verificationToken }),
      });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/auth/login
// Rate: 5 per 15 minutes per IP (authLimiter)
// =====================================================================
router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await loginUser(req.body, req);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      sendSuccess(res, {
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/auth/refresh
// Uses refresh token from httpOnly cookie — no body/header needed
// =====================================================================
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          data: null,
          error: 'No refresh token provided',
        });
        return;
      }

      const result = await refreshAccessToken(refreshToken, req);
      sendSuccess(res, { accessToken: result.accessToken });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/auth/logout
// Clears the httpOnly refresh token cookie
// =====================================================================
router.post(
  '/logout',
  async (_req: Request, res: Response) => {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });

    sendSuccess(res, { message: 'Logged out successfully' });
  },
);

// =====================================================================
// POST /api/v1/auth/verify-email
// =====================================================================
router.post(
  '/verify-email',
  validate({ body: verifyEmailSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await verifyEmail(req.body.token, req);
      sendSuccess(res, { message: 'Email verified successfully', userId: result.userId });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/auth/forgot-password
// Rate: 5 per 15 minutes per IP (authLimiter)
// Always returns success to prevent email enumeration
// =====================================================================
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await requestPasswordReset(req.body.email, req);

      // Always return success regardless of whether user exists
      sendSuccess(res, {
        message: 'If an account with that email exists, a password reset link has been sent.',
        // In dev mode, include token for testing
        ...(env.NODE_ENV !== 'production' && result.resetToken && { resetToken: result.resetToken }),
      });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/auth/reset-password
// =====================================================================
router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await resetPassword(req.body.token, req.body.password, req);
      sendSuccess(res, { message: 'Password reset successfully. Please log in with your new password.' });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// POST /api/v1/auth/change-password (authenticated)
// =====================================================================
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await changePassword(
        req.user!.userId,
        req.body.currentPassword,
        req.body.newPassword,
        req,
      );
      sendSuccess(res, { message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  },
);

// =====================================================================
// GET /api/v1/auth/me (authenticated)
// Returns current user profile — NEVER returns security fields
// =====================================================================
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getCurrentUser(req.user!.userId);
      sendSuccess(res, { user });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
