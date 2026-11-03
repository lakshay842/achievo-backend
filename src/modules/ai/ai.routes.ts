import { Router } from 'express';
import { z } from 'zod';
import { aiRateLimit } from '../../middleware/rate-limit.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, objectIdSchema } from '../../utils/zod';
import {
  analyzeHandler,
  chatHandler,
  clarifyHandler,
  evaluateHandler,
  explainHandler,
  generateHandler,
  replanHandler,
} from './ai.controller';

const analyzeSchema = z.object({
  body: z.object({
    goalId: objectIdSchema.optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional(),
    category: z.string().trim().min(1).max(50).optional(),
    currentLevel: z.string().trim().max(200).optional(),
    desiredOutcome: z.string().trim().max(2000).optional(),
    availableMinutesPerDay: z.number().int().min(15).max(480),
    durationDays: z.number().int().min(1).max(180),
  }),
  query: emptyObject,
  params: emptyObject,
});

const clarifySchema = z.object({
  body: z.object({
    goalId: objectIdSchema,
    answers: z
      .array(
        z.object({
          questionId: z.string().trim().min(1).max(40).optional(),
          question: z.string().trim().min(1).max(300).optional(),
          answer: z.string().trim().min(1).max(2000),
        }),
      )
      .min(1),
  }),
  query: emptyObject,
  params: emptyObject,
});

const generateSchema = z.object({
  body: z.object({ goalId: objectIdSchema }),
  query: emptyObject,
  params: emptyObject,
});

const replanSchema = z.object({
  body: emptyObject,
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});

const chatSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1).max(4000),
    conversationId: z.string().trim().min(8).max(80).optional(),
    goalId: objectIdSchema.optional(),
  }),
  query: emptyObject,
  params: emptyObject,
});

const taskParamSchema = z.object({
  body: emptyObject,
  query: emptyObject,
  params: z.object({ taskId: objectIdSchema }),
});

const evaluateSchema = z.object({
  body: z.object({ submission: z.string().trim().min(1).max(8000) }),
  query: emptyObject,
  params: z.object({ taskId: objectIdSchema }),
});

export const aiRoutes = Router();

aiRoutes.use(requireAuth, aiRateLimit);
aiRoutes.post('/goals/analyze', validate(analyzeSchema), analyzeHandler);
aiRoutes.post('/goals/clarify', validate(clarifySchema), clarifyHandler);
aiRoutes.post('/roadmaps/generate', validate(generateSchema), generateHandler);
aiRoutes.post('/roadmaps/:id/replan', validate(replanSchema), replanHandler);
aiRoutes.post('/chat', validate(chatSchema), chatHandler);
aiRoutes.post('/tasks/:taskId/explain', validate(taskParamSchema), explainHandler);
aiRoutes.post('/tasks/:taskId/evaluate', validate(evaluateSchema), evaluateHandler);
