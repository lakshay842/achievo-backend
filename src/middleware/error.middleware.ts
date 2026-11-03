import { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';
import { AiError } from '../modules/ai/providers/ai-error';
import { ApiError } from '../utils/ApiError';
import { redactConnectionString } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof AiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: { code: err.code },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  if (err instanceof MongooseError.CastError) {
    res.status(400).json({ success: false, message: 'Invalid identifier' });
    return;
  }

  if (err instanceof MongooseError.ValidationError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: Object.values(err.errors).map((item) => ({ path: item.path, message: item.message })),
    });
    return;
  }

  const mongoCode = typeof err === 'object' && err && 'code' in err ? (err as { code?: number }).code : undefined;
  if (mongoCode === 11000) {
    res.status(409).json({ success: false, message: 'A record with that value already exists' });
    return;
  }

  const message = err instanceof Error ? redactConnectionString(err.message) : 'Unexpected error';
  logger.error({ message, name: err instanceof Error ? err.name : 'Error' }, 'Unhandled error');

  res.status(500).json({
    success: false,
    message: env.isProduction ? 'Internal server error' : message,
  });
}
