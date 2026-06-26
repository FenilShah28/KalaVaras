/**
 * Database schema barrel export.
 * All table schemas defined per Document 5 Section 5.1
 * with Phase 2 security additions (audit_log, security columns on users).
 *
 * Tables (in creation order for FK dependencies):
 * 1. users — artisan/apprentice/researcher/admin accounts + security fields
 * 2. stroke_cards — atomic motor vocabulary cards per tradition
 * 3. media_assets — R2 media references (video, slit-scan, waveform, GIF)
 * 4. practice_sessions — apprentice practice attempts + scoring
 * 5. sync_queue — offline action queue for batch sync
 * 6. audit_log — security event and mutation audit trail
 */
export { users, roleEnum } from './users.js';
export {
  strokeCards,
  traditionEnum,
  visibilityEnum,
} from './strokeCards.js';
export {
  mediaAssets,
  mediaTypeEnum,
  processingStatusEnum,
} from './mediaAssets.js';
export { practiceSessions } from './practiceSessions.js';
export {
  syncQueue,
  syncActionEnum,
  syncStatusEnum,
} from './syncQueue.js';
export { auditLog } from './auditLog.js';
