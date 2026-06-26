import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js';
import { securityLogger } from '../utils/logger.js';

/**
 * Ownership resource interface — any resource with an owner_id.
 */
interface OwnedResource {
  owner_id?: string;
  artisan_id?: string;
  apprentice_id?: string;
  user_id?: string;
}

/**
 * Assert that the authenticated user owns the given resource.
 *
 * IDOR Prevention Pattern:
 * 1. Fetch the resource from the database FIRST.
 * 2. Compare resource.owner_id === authenticated user_id in application code.
 * 3. Return 403 ForbiddenError (not 404) so we can distinguish in internal logs.
 *
 * Never use `WHERE id = :id AND owner_id = :userId` as the only protection.
 * Always fetch first, then check ownership so we can return proper errors.
 *
 * For public-facing responses: the error handler maps ForbiddenError to 404
 * to avoid leaking resource existence to unauthorised users.
 */
export function assertOwnership(
  resource: OwnedResource | null | undefined,
  userId: string,
  resourceType = 'resource',
): void {
  if (!resource) {
    throw new NotFoundError(`${resourceType} not found`);
  }

  // Check all possible ownership fields
  const ownerId = resource.owner_id || resource.artisan_id || resource.apprentice_id || resource.user_id;

  if (ownerId !== userId) {
    // Log the IDOR attempt for security monitoring
    securityLogger.idorAttempt({
      attemptedResourceType: resourceType,
      authenticatedUserId: userId,
      resourceOwnerId: ownerId,
    });

    // Throw ForbiddenError internally — error handler may map to 404 externally
    throw new ForbiddenError(`You do not have permission to access this ${resourceType}`);
  }
}

/**
 * Middleware factory for ownership-checked routes.
 * Wraps a route handler to automatically enforce ownership on fetched resources.
 *
 * Usage:
 *   router.get('/:id', authenticate, withOwnership(fetchStrokeCard, 'stroke_card'), handler);
 */
export function withOwnership(
  fetchResource: (id: string) => Promise<OwnedResource | null>,
  resourceType: string,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = req.params['id'] as string | undefined;
      if (!resourceId) {
        throw new NotFoundError(`${resourceType} ID required`);
      }

      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const resource = await fetchResource(resourceId);
      assertOwnership(resource, req.user.userId, resourceType);

      // Attach resource to request for downstream use
      (req as unknown as Record<string, unknown>)['resource'] = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
}
