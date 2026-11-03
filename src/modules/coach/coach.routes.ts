import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { aiRateLimit } from '../../middleware/rate-limit.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, objectIdSchema } from '../../utils/zod';
import { coachChatHandler, coachHistoryHandler, motivationHandler } from './coach.controller';

const chatSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1).max(4000),
    conversationId: z.string().trim().min(8).max(80).optional(),
    goalId: objectIdSchema.optional(),
  }),
  query: emptyObject,
  params: emptyObject,
});

const historySchema = z.object({
  body: emptyObject,
  query: z.object({
    conversationId: z.string().trim().min(8).max(80).optional(),
  }),
  params: emptyObject,
});

export const coachRoutes = Router();

coachRoutes.use(requireAuth);
coachRoutes.get('/motivation', motivationHandler);
coachRoutes.get('/chat/history', validate(historySchema), coachHistoryHandler);
coachRoutes.post('/chat', aiRateLimit, validate(chatSchema), coachChatHandler);
