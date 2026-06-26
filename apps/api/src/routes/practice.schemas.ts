import { z } from 'zod';

/**
 * Practice session validation schemas.
 */

export const submitPracticeSchema = z.object({
  strokeCardId: z.string().uuid('Invalid stroke card ID'),
  deviationScore: z.number().min(0).max(1, 'Deviation score must be between 0 and 1').optional(),
  rhythmAccuracy: z.number().min(0).max(1, 'Rhythm accuracy must be between 0 and 1').optional(),
  durationSeconds: z.number().positive().max(3600).optional(),
  practiceVideoKey: z.string().max(500).optional(),
});

export const listPracticeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  strokeCardId: z.string().uuid().optional(),
});

export type SubmitPracticeInput = z.infer<typeof submitPracticeSchema>;
export type ListPracticeQuery = z.infer<typeof listPracticeQuerySchema>;
