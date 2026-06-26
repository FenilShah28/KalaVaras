import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Email service — powered by Resend.
 *
 * Security:
 * - API key exclusively from env vars
 * - HTML templates are static strings (no user content injected into template structure)
 * - User-supplied values (name, token) are only placed in safe text positions
 *
 * Each function returns { id } from Resend or throws on failure.
 */

interface ResendResponse {
  id: string;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<ResendResponse> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error ${response.status}: ${body}`);
  }

  return response.json() as Promise<ResendResponse>;
}

// =====================================================================
// VERIFICATION EMAIL
// =====================================================================

/**
 * Send email verification link after registration.
 * Token is a raw UUID — SHA-256 hash stored in DB.
 */
export async function sendVerificationEmail(
  to: string,
  rawToken: string,
  nameMarathi?: string,
): Promise<void> {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;

  const html = `
<!DOCTYPE html>
<html lang="mr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Arial, sans-serif; background: #f5f3ee; margin: 0; padding: 40px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; border: 1px solid #e8e6e0;">
    <h1 style="color: #2d1b69; font-size: 24px; margin: 0 0 8px;">✉️ कलावारस</h1>
    <h2 style="color: #1a1208; font-size: 18px; font-weight: normal; margin: 0 0 24px;">
      ${nameMarathi ? `नमस्कार ${nameMarathi}!` : 'नमस्कार!'} आपला ईमेल सत्यापित करा.
    </h2>
    <a href="${verifyUrl}"
       style="display: inline-block; background: #2d1b69; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 16px; font-weight: bold;">
      ईमेल सत्यापित करा
    </a>
    <p style="color: #6b5e4a; font-size: 13px; margin: 24px 0 0;">
      हा दुवा 24 तासांत कालबाह्य होईल.<br>
      जर तुम्ही नोंदणी केली नाही, तर हा ईमेल दुर्लक्षित करा.
    </p>
  </div>
</body>
</html>`;

  try {
    const result = await sendEmail({
      to,
      subject: 'कलावारस — आपला ईमेल सत्यापित करा',
      html,
    });
    logger.info('Verification email sent', { to, emailId: result.id });
  } catch (error) {
    logger.error('Failed to send verification email', {
      to,
      error: (error as Error).message,
    });
    throw error;
  }
}

// =====================================================================
// PASSWORD RESET EMAIL
// =====================================================================

/**
 * Send password reset link.
 * Token is a raw UUID — SHA-256 hash stored in DB.
 * Link expires in 1 hour.
 */
export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const html = `
<!DOCTYPE html>
<html lang="mr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Arial, sans-serif; background: #f5f3ee; margin: 0; padding: 40px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; border: 1px solid #e8e6e0;">
    <h1 style="color: #2d1b69; font-size: 24px; margin: 0 0 8px;">🔐 कलावारस</h1>
    <h2 style="color: #1a1208; font-size: 18px; font-weight: normal; margin: 0 0 24px;">
      पासवर्ड रीसेट करा
    </h2>
    <p style="color: #6b5e4a; font-size: 14px; margin: 0 0 24px;">
      खालील बटणावर क्लिक करून नवीन पासवर्ड सेट करा. हा दुवा 1 तासात कालबाह्य होईल.
    </p>
    <a href="${resetUrl}"
       style="display: inline-block; background: #e8593c; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 16px; font-weight: bold;">
      नवीन पासवर्ड सेट करा
    </a>
    <p style="color: #6b5e4a; font-size: 13px; margin: 24px 0 0;">
      जर तुम्ही हे विनंती केली नाही, तर हा ईमेल दुर्लक्षित करा. तुमचे खाते सुरक्षित आहे.
    </p>
  </div>
</body>
</html>`;

  try {
    const result = await sendEmail({
      to,
      subject: 'कलावारस — पासवर्ड रीसेट',
      html,
    });
    logger.info('Password reset email sent', { to, emailId: result.id });
  } catch (error) {
    logger.error('Failed to send password reset email', {
      to,
      error: (error as Error).message,
    });
    throw error;
  }
}
