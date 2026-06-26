/**
 * Typed error classes for consistent error handling.
 * Each error type maps to an HTTP status code.
 * The error handler middleware catches these and returns the correct response envelope.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400 — Invalid input, validation failure */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

/** 401 — Missing or invalid authentication */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

/**
 * 403 — User is authenticated but lacks permission.
 * Used by assertOwnership middleware for IDOR prevention.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

/**
 * 404 — Resource not found.
 * IMPORTANT: For unauthorized access to existing resources, return 404 (not 403)
 * to avoid leaking resource existence. See IDOR prevention rules.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

/** 409 — Conflict (e.g., duplicate email, username taken) */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

/** 429 — Rate limit exceeded */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429);
  }
}

/** 422 — Unprocessable entity (valid syntax but semantic error) */
export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422);
  }
}
