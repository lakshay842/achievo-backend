export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;
  readonly isOperational = true;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(resource: string): ApiError {
  return new ApiError(404, `${resource} not found`);
}
