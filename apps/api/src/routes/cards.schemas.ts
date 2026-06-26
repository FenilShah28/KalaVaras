import { z } from 'zod';

/**
 * Stroke Card validation schemas.
 * All inputs validated at API boundary before reaching service layer.
 */

const traditionValues = ['warli', 'kolam', 'pichwai', 'madhubani'] as const;
const visibilityValues = ['private', 'community', 'public', 'research'] as const;

export const createCardSchema = z.object({
  tradition: z.enum(traditionValues, {
    errorMap: () => ({ message: 'Tradition must be warli, kolam, pichwai, or madhubani' }),
  }),
  nameMarathi: z.string().trim().min(2, 'Name must be at least 2 characters').max(200),
  nameEnglish: z.string().trim().min(2).max(200).optional(),
  descriptionMarathi: z.string().trim().max(5000).optional(),
  descriptionEnglish: z.string().trim().max(5000).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  atomicUnits: z.array(z.object({
    unit_id: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    sequence_order: z.number().int().min(0),
  })).optional(),
  visibility: z.enum(visibilityValues).default('community'),
});

export const updateCardSchema = z.object({
  nameMarathi: z.string().trim().min(2).max(200).optional(),
  nameEnglish: z.string().trim().min(2).max(200).optional(),
  descriptionMarathi: z.string().trim().max(5000).optional(),
  descriptionEnglish: z.string().trim().max(5000).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  atomicUnits: z.array(z.object({
    unit_id: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    sequence_order: z.number().int().min(0),
  })).optional(),
  visibility: z.enum(visibilityValues).optional(),
});

export const listCardsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tradition: z.enum(traditionValues).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  visibility: z.enum(visibilityValues).optional(),
  search: z.string().trim().max(200).optional(),
  ownerId: z.string().uuid().optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;
