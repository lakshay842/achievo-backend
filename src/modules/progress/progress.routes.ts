import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, objectIdSchema } from '../../utils/zod';
import { goalProgressHandler, monthlyHandler, overviewHandler, streaksHandler, weeklyHandler } from './progress.controller';

const idSchema = z.object({
  body: emptyObject,
  query: emptyObject,
  params: z.object({ id: objectIdSchema }),
});

export const progressRoutes = Router();

progressRoutes.use(requireAuth);
progressRoutes.get('/overview', overviewHandler);
progressRoutes.get('/streaks', streaksHandler);
progressRoutes.get('/weekly', weeklyHandler);
progressRoutes.get('/monthly', monthlyHandler);
progressRoutes.get('/goals/:id', validate(idSchema), goalProgressHandler);
