import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { env } from '../config/env.js';
import { users } from '../db/schema/index.js';
import { writeAuditLog, extractRequestContext } from '../db/auditLog.service.js';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  RateLimitError,
} from '../utils/errors.js';
import { logger, securityLogger } from '../utils/logger.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service.js';
import type { RegisterInput, LoginInput } from '../routes/auth.schemas.js';

// =====================================================================
// CONSTANTS
// =====================================================================

/** bcrypt cost factor — Doc 2 Section 2.8 specifies cost 12 */
const BCRYPT_COST = 12;

/** Access token lifetime: 15 minutes */
const ACCESS_TOKEN_EXPIRY = '15m';

/** Refresh token lifetime: 7 days */
const REFRESH_TOKEN_EXPIRY = '7d';

/** Max failed login attempts before lockout */
const MAX_LOGIN_ATTEMPTS = 10;

/** Account lockout duration: 30 minutes */
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

/** Email verification token expiry: 24 hours */
const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Password reset token expiry: 1 hour */
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

// =====================================================================
// TOKEN HELPERS
// =====================================================================

interface TokenPayload {
  userId: string;
  role: string;
  emailVerified: boolean;
}

/**
 * Generate a JWT access token (short-lived, in-memory only on client).
 */
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'kalavaras-api',
    audience: 'kalavaras-web',
  });
}

/**
 * Generate a JWT refresh token (long-lived, httpOnly cookie on client).
 */
function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'kalavaras-api',
    audience: 'kalavaras-web',
  });
}

/**
 * Hash a raw token with SHA-256 for database storage.
 * NEVER store raw verification/reset tokens in the DB.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a cryptographically secure random token.
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// =====================================================================
// REGISTRATION
// =====================================================================

export async function registerUser(
  input: RegisterInput,
  reqContext: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const { email, password, nameMarathi, nameEnglish, role, village, district, traditions, yearsExperience } = input;

  // Check for existing user with same email
  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser.length > 0) {
    throw new ConflictError('An account with this email already exists');
  }

  // Hash password with bcrypt cost 12
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // Generate email verification token
  const rawVerificationToken = generateSecureToken();
  const hashedVerificationToken = hashToken(rawVerificationToken);
  const verificationExpires = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);

  // Insert user
  const [newUser] = await db.insert(users).values({
    email,
    passwordHash,
    nameMarathi,
    nameEnglish: nameEnglish ?? null,
    role,
    village: village ?? null,
    district: district ?? 'Pune',
    traditions: traditions ?? null,
    yearsExperience: yearsExperience ?? null,
    emailVerified: false,
    emailVerificationToken: hashedVerificationToken,
    emailVerificationExpires: verificationExpires,
    failedLoginAttempts: 0,
  }).returning({
    id: users.id,
    email: users.email,
    nameMarathi: users.nameMarathi,
    role: users.role,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
  });

  // Audit log
  const ctx = extractRequestContext(reqContext);
  await writeAuditLog({
    userId: newUser!.id,
    action: 'auth:register',
    resourceType: 'user',
    resourceId: newUser!.id,
    ...ctx,
  });

  logger.info('User registered', { userId: newUser!.id, role });

  // Send verification email — non-blocking (don't fail registration if email fails)
  sendVerificationEmail(email, rawVerificationToken, input.nameMarathi).catch(err =>
    logger.error('Verification email failed (non-fatal)', { userId: newUser!.id, error: err.message }),
  );

  return {
    user: newUser,
    // In production, token is emailed. Return for dev/test environments only.
    verificationToken: env.NODE_ENV !== 'production' ? rawVerificationToken : undefined,
  };
}

// =====================================================================
// LOGIN
// =====================================================================

export async function loginUser(
  input: LoginInput,
  reqContext: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const { email, password } = input;
  const ctx = extractRequestContext(reqContext);

  // Fetch user with security fields
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    passwordHash: users.passwordHash,
    role: users.role,
    nameMarathi: users.nameMarathi,
    emailVerified: users.emailVerified,
    failedLoginAttempts: users.failedLoginAttempts,
    lockedUntil: users.lockedUntil,
  }).from(users).where(eq(users.email, email)).limit(1);

  // User not found — return generic error (don't reveal whether email exists)
  if (!user) {
    await writeAuditLog({
      action: 'auth:login_failure',
      details: 'Unknown email',
      ...ctx,
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check account lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60_000);

    securityLogger.authEvent('Login attempt on locked account', {
      userId: user.id,
      lockedUntil: user.lockedUntil,
      ...ctx,
    });

    await writeAuditLog({
      userId: user.id,
      action: 'auth:login_locked',
      ...ctx,
    });

    throw new RateLimitError(`Account is locked. Try again in ${remainingMin} minutes.`);
  }

  // Verify password
  if (!user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    const newAttempts = (user.failedLoginAttempts ?? 0) + 1;

    // Lock account after MAX_LOGIN_ATTEMPTS
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

      await db.update(users).set({
        failedLoginAttempts: newAttempts,
        lockedUntil: lockoutUntil,
      }).where(eq(users.id, user.id));

      securityLogger.authEvent('Account locked due to excessive login failures', {
        userId: user.id,
        attempts: newAttempts,
        lockedUntil: lockoutUntil,
        ...ctx,
      });

      await writeAuditLog({
        userId: user.id,
        action: 'auth:account_locked',
        details: `Locked after ${newAttempts} failed attempts`,
        ...ctx,
      });

      throw new RateLimitError('Account locked due to too many failed login attempts. Try again in 30 minutes.');
    }

    // Increment failed attempts
    await db.update(users).set({
      failedLoginAttempts: newAttempts,
    }).where(eq(users.id, user.id));

    await writeAuditLog({
      userId: user.id,
      action: 'auth:login_failure',
      details: `Attempt ${newAttempts}/${MAX_LOGIN_ATTEMPTS}`,
      ...ctx,
    });

    const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
    throw new UnauthorizedError(
      remaining <= 3
        ? `Invalid email or password. ${remaining} attempts remaining before lockout.`
        : 'Invalid email or password',
    );
  }

  // Successful login — reset failed attempts
  await db.update(users).set({
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
    lastLoginIp: ctx.ipAddress,
    lastActive: new Date(),
  }).where(eq(users.id, user.id));

  // Generate tokens
  const tokenPayload: TokenPayload = {
    userId: user.id,
    role: user.role,
    emailVerified: user.emailVerified,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await writeAuditLog({
    userId: user.id,
    action: 'auth:login_success',
    ...ctx,
  });

  logger.info('User logged in', { userId: user.id, role: user.role });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      nameMarathi: user.nameMarathi,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  };
}

// =====================================================================
// TOKEN REFRESH
// =====================================================================

export async function refreshAccessToken(
  refreshTokenValue: string,
  reqContext: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const ctx = extractRequestContext(reqContext);

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(refreshTokenValue, env.JWT_REFRESH_SECRET, {
      issuer: 'kalavaras-api',
      audience: 'kalavaras-web',
    }) as TokenPayload;
  } catch {
    await writeAuditLog({
      action: 'auth:token_refresh_failure',
      details: 'Invalid or expired refresh token',
      ...ctx,
    });
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Verify user still exists and is not locked
  const [user] = await db.select({
    id: users.id,
    role: users.role,
    emailVerified: users.emailVerified,
    lockedUntil: users.lockedUntil,
  }).from(users).where(eq(users.id, decoded.userId)).limit(1);

  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new UnauthorizedError('Account is locked');
  }

  // Generate new access token with fresh data
  const newPayload: TokenPayload = {
    userId: user.id,
    role: user.role,
    emailVerified: user.emailVerified,
  };

  const accessToken = generateAccessToken(newPayload);

  // Update last_active
  await db.update(users).set({ lastActive: new Date() }).where(eq(users.id, user.id));

  await writeAuditLog({
    userId: user.id,
    action: 'auth:token_refresh',
    ...ctx,
  });

  return { accessToken };
}

// =====================================================================
// EMAIL VERIFICATION
// =====================================================================

export async function verifyEmail(
  rawToken: string,
  reqContext: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const ctx = extractRequestContext(reqContext);
  const hashedToken = hashToken(rawToken);

  const [user] = await db.select({
    id: users.id,
    emailVerified: users.emailVerified,
    emailVerificationToken: users.emailVerificationToken,
    emailVerificationExpires: users.emailVerificationExpires,
  }).from(users).where(eq(users.emailVerificationToken, hashedToken)).limit(1);

  if (!user) {
    throw new BadRequestError('Invalid verification token');
  }

  if (user.emailVerified) {
    throw new BadRequestError('Email is already verified');
  }

  if (user.emailVerificationExpires && new Date(user.emailVerificationExpires) < new Date()) {
    throw new BadRequestError('Verification token has expired. Please request a new one.');
  }

  // Mark as verified and clear token
  await db.update(users).set({
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
  }).where(eq(users.id, user.id));

  await writeAuditLog({
    userId: user.id,
    action: 'auth:email_verified',
    ...ctx,
  });

  logger.info('Email verified', { userId: user.id });

  return { userId: user.id };
}

// =====================================================================
// PASSWORD RESET — REQUEST
// =====================================================================

export async function requestPasswordReset(
  email: string,
  reqContext: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const ctx = extractRequestContext(reqContext);

  // Always return success (don't reveal whether email exists)
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (user) {
    const rawResetToken = generateSecureToken();
    const hashedResetToken = hashToken(rawResetToken);
    const resetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

    await db.update(users).set({
      passwordResetToken: hashedResetToken,
      passwordResetExpires: resetExpires,
    }).where(eq(users.id, user.id));

    await writeAuditLog({
      userId: user.id,
      action: 'auth:password_reset_request',
      ...ctx,
    });

    // Send reset email — non-blocking
    sendPasswordResetEmail(email, rawResetToken).catch(err =>
      logger.error('Password reset email failed (non-fatal)', { userId: user.id, error: err.message }),
    );

    logger.info('Password reset requested', { userId: user.id });

    // In production, token is emailed. Return for dev/test environments only.
    return { resetToken: env.NODE_ENV !== 'production' ? rawResetToken : undefined };
  }

  // Log attempt for unknown email (security monitoring)
  await writeAuditLog({
    action: 'auth:password_reset_request',
    details: 'Unknown email — no action taken',
    ...ctx,
  });

  return { resetToken: undefined };
}

// =====================================================================
// PASSWORD RESET — COMPLETE
// =====================================================================

export async function resetPassword(
  rawToken: string,
  newPassword: string,
  reqContext: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const ctx = extractRequestContext(reqContext);
  const hashedToken = hashToken(rawToken);

  const [user] = await db.select({
    id: users.id,
    passwordResetToken: users.passwordResetToken,
    passwordResetExpires: users.passwordResetExpires,
  }).from(users).where(eq(users.passwordResetToken, hashedToken)).limit(1);

  if (!user) {
    throw new BadRequestError('Invalid reset token');
  }

  if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
    throw new BadRequestError('Reset token has expired. Please request a new one.');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  // Update password, clear reset token, reset failed attempts, clear lockout
  await db.update(users).set({
    passwordHash: newPasswordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  }).where(eq(users.id, user.id));

  await writeAuditLog({
    userId: user.id,
    action: 'auth:password_reset_complete',
    ...ctx,
  });

  logger.info('Password reset completed', { userId: user.id });

  return { userId: user.id };
}

// =====================================================================
// CHANGE PASSWORD (authenticated)
// =====================================================================

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  reqContext: { ip?: string; headers: Record<string, string | string[] | undefined> },
) {
  const ctx = extractRequestContext(reqContext);

  const [user] = await db.select({
    id: users.id,
    passwordHash: users.passwordHash,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('User not found');
  }

  const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentValid) {
    await writeAuditLog({
      userId: user.id,
      action: 'auth:change_password_failure',
      details: 'Current password incorrect',
      ...ctx,
    });
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await db.update(users).set({
    passwordHash: newPasswordHash,
  }).where(eq(users.id, user.id));

  await writeAuditLog({
    userId: user.id,
    action: 'auth:change_password_success',
    ...ctx,
  });

  logger.info('Password changed', { userId: user.id });

  return { success: true };
}

// =====================================================================
// GET CURRENT USER (profile data — no security fields)
// =====================================================================

export async function getCurrentUser(userId: string) {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    nameMarathi: users.nameMarathi,
    nameEnglish: users.nameEnglish,
    role: users.role,
    village: users.village,
    district: users.district,
    traditions: users.traditions,
    yearsExperience: users.yearsExperience,
    avatarUrl: users.avatarUrl,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
    lastActive: users.lastActive,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // NEVER return: passwordHash, tokens, failedLoginAttempts, lockedUntil, loginIp
  return user;
}
