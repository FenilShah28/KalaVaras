import hpp from 'hpp';

/**
 * HTTP Parameter Pollution prevention.
 * Strips duplicate query params to prevent HPP attacks.
 * Applied on all routes as global middleware.
 */
export const hppMiddleware = hpp();
