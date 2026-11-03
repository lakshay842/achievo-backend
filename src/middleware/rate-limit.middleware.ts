import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

function buildLimiter(limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
  });
}

export const apiRateLimit = buildLimiter(300, 15 * 60 * 1000);
export const authRateLimit = buildLimiter(20, 15 * 60 * 1000);
export const aiRateLimit = buildLimiter(30, 60 * 1000);
