import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validate =
  (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });

    if (!parsed.success) {
      next(new ApiError(400, 'Validation failed', formatZodError(parsed.error)));
      return;
    }

    req.validated = parsed.data as { body: unknown; query: unknown; params: unknown };
    next();
  };

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
