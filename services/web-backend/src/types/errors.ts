export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Error', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details)
  }
}
