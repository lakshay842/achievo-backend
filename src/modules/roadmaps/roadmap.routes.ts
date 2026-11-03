import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, isoDateSchema, objectIdSchema } from '../../utils/zod';
import { approveRoadmapHandler, getRoadmapHandler, listRoadmapsHandler } from './roadmap.controller';

const listSchema = z.object({
  body: emptyObject,
  query: z.object({ goalId: objectIdSchema.optional() }),
  params: emptyObject,
});

const idSchema = z.object({
  body: emptyObject,
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});

const approveSchema = z.object({
  body: z.object({ startDate: isoDateSchema.optional() }),
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});

export const roadmapRoutes = Router();

roadmapRoutes.use(requireAuth);
roadmapRoutes.get('/', validate(listSchema), listRoadmapsHandler);
roadmapRoutes.get('/:id', validate(idSchema), getRoadmapHandler);
roadmapRoutes.post('/:id/approve', validate(approveSchema), approveRoadmapHandler);
