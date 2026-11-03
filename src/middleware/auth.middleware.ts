import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

interface AccessPayload extends jwt.JwtPayload {
  sub: string;
  type: 'access';
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), env.jwtAccessSecret) as AccessPayload;
    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      next(new ApiError(401, 'Invalid access token'));
      return;
    }
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired access token'));
  }
}
