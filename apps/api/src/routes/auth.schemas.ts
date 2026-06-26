import { z } from 'zod';

/**
 * Auth validation schemas — Zod at the API boundary.
 *
 * These schemas enforce:
 * - Email format validation
 * - Password complexity: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special
 * - Name fields: min 2 chars
 * - Role must be a valid enum value
 * - All inputs trimmed to prevent whitespace attacks
 */

/**
 * Password rules matching Doc 2 Section 2.8:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character (!@#$%^&*()_+-=[]{}|;:'",./<>?)
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{}|;:'",./<>?]/,
    'Password must contain at least one special character',
  );

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email format').max(255),
  password: passwordSchema,
  confirmPassword: z.string(),
  nameMarathi: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  nameEnglish: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['artisan', 'apprentice'], {
    errorMap: () => ({ message: 'Role must be artisan or apprentice' }),
  }),
  village: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  traditions: z.array(z.enum(['warli', 'kolam', 'pichwai', 'madhubani'])).optional(),
  yearsExperience: z.number().int().min(0).max(100).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email format').max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
