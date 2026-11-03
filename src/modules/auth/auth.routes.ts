import { Router } from 'express';
import { authRateLimit } from '../../middleware/rate-limit.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  resetPasswordHandler,
} from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validation';

export const authRoutes = Router();

authRoutes.post('/register', authRateLimit, validate(registerSchema), registerHandler);
authRoutes.post('/login', authRateLimit, validate(loginSchema), loginHandler);
authRoutes.post('/logout', requireAuth, validate(logoutSchema), logoutHandler);
authRoutes.post('/refresh', authRateLimit, validate(refreshSchema), refreshHandler);
authRoutes.get('/me', requireAuth, meHandler);
authRoutes.post('/forgot-password', authRateLimit, validate(forgotPasswordSchema), forgotPasswordHandler);
authRoutes.post('/reset-password', authRateLimit, validate(resetPasswordSchema), resetPasswordHandler);
