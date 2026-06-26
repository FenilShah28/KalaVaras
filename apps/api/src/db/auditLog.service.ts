import { db } from '../config/database.js';
import { auditLog } from './schema/index.js';

/**
 * Audit log service — writes to the audit_log table on every
 * auth event and data mutation.
 *
 * SECURITY: This is the single entry point for audit logging.
 * Every auth event, data mutation, and IDOR attempt MUST go through here.
 *
 * NEVER log: passwords, tokens, full file paths, raw SQL queries with data.
 * ALWAYS log: timestamps, IP, user agent, user_id, action, resource context.
 */

interface AuditEntry {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: entry.userId ?? undefined,
      action: entry.action,
      resourceType: entry.resourceType ?? undefined,
      resourceId: entry.resourceId ?? undefined,
      ipAddress: entry.ipAddress ?? undefined,
      userAgent: entry.userAgent ?? undefined,
      details: entry.details ?? undefined,
    });
  } catch (error) {
    // Audit log write failure must not crash the application.
    // Log to Winston instead — this is a fallback.
    console.error('[AUDIT LOG WRITE FAILURE]', {
      error: (error as Error).message,
      entry: { ...entry, details: undefined }, // Don't log details in fallback
    });
  }
}

/**
 * Helper to extract IP and user agent from Express request.
 * Used by route handlers to populate audit log entries.
 */
export function extractRequestContext(req: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
  return {
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
    userAgent: (req.headers['user-agent'] as string) || 'unknown',
  };
}
