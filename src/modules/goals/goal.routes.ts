import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, isoDateSchema, objectIdSchema, paginationQuerySchema } from '../../utils/zod';
import { GOAL_STATUSES } from './goal.model';
import {
  activateGoalHandler,
  archiveGoalHandler,
  createGoalHandler,
  assessmentHandler,
  deleteGoalHandler,
  getGoalHandler,
  listGoalsHandler,
  pauseGoalHandler,
  resumeGoalHandler,
  updateGoalHandler,
} from './goal.controller';

const goalBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  currentLevel: z.string().trim().max(200).optional(),
  desiredOutcome: z.string().trim().max(2000).optional(),
  availableMinutesPerDay: z.number().int().min(15).max(480),
  durationDays: z.number().int().min(1).max(180),
  startDate: isoDateSchema.optional(),
  targetDate: isoDateSchema.optional(),
});

const createSchema = z.object({ body: goalBody, query: emptyObject, params: emptyObject });
const updateSchema = z.object({
  body: goalBody.partial().refine((value) => Object.keys(value).length > 0, { message: 'Provide a field to update' }),
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});
const idSchema = z.object({ body: emptyObject, query: emptyObject, params: z.object({ id: objectIdSchema }) });
const listSchema = z.object({
  body: emptyObject,
  query: paginationQuerySchema.extend({ status: z.enum(GOAL_STATUSES).optional() }),
  params: emptyObject,
});

export const goalRoutes = Router();

goalRoutes.use(requireAuth);
goalRoutes.post('/', validate(createSchema), createGoalHandler);
goalRoutes.get('/', validate(listSchema), listGoalsHandler);
goalRoutes.get('/:id/assessment', validate(idSchema), assessmentHandler);
goalRoutes.get('/:id', validate(idSchema), getGoalHandler);
goalRoutes.patch('/:id', validate(updateSchema), updateGoalHandler);
goalRoutes.post('/:id/pause', validate(idSchema), pauseGoalHandler);
goalRoutes.post('/:id/resume', validate(idSchema), resumeGoalHandler);
goalRoutes.post('/:id/archive', validate(idSchema), archiveGoalHandler);
goalRoutes.post('/:id/activate', validate(idSchema), activateGoalHandler);
goalRoutes.delete('/:id', validate(idSchema), deleteGoalHandler);
