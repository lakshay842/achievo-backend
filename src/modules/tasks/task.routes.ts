import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, isoDateSchema, objectIdSchema, paginationQuerySchema } from '../../utils/zod';
import { TASK_STATUSES } from './task.model';
import {
  completeTaskHandler,
  feedbackHandler,
  getTaskHandler,
  listTasksHandler,
  rescheduleTaskHandler,
  skipTaskHandler,
  startTaskHandler,
  todayHandler,
} from './task.controller';

const idSchema = z.object({
  body: emptyObject,
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});

const listSchema = z.object({
  body: emptyObject,
  query: paginationQuerySchema.extend({
    status: z.enum(TASK_STATUSES).optional(),
    goalId: objectIdSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  }),
  params: emptyObject,
});

const rescheduleSchema = z.object({
  body: z.object({ taskDate: isoDateSchema }),
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});

const feedbackSchema = z.object({
  body: z.object({
    difficulty: z.enum(['easy', 'moderate', 'hard']),
    note: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().trim().max(1000).optional(),
    ),
  }),
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});

export const taskRoutes = Router();

taskRoutes.use(requireAuth);
taskRoutes.get('/today', todayHandler);
taskRoutes.get('/', validate(listSchema), listTasksHandler);
taskRoutes.get('/:id', validate(idSchema), getTaskHandler);
taskRoutes.post('/:id/start', validate(idSchema), startTaskHandler);
taskRoutes.post('/:id/complete', validate(idSchema), completeTaskHandler);
taskRoutes.post('/:id/skip', validate(idSchema), skipTaskHandler);
taskRoutes.post('/:id/reschedule', validate(rescheduleSchema), rescheduleTaskHandler);
taskRoutes.post('/:id/feedback', validate(feedbackSchema), feedbackHandler);
