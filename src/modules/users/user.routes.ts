import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, timezoneSchema } from '../../utils/zod';
import { getMe, patchMe } from './user.controller';

const patchSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      timezone: timezoneSchema.optional(),
    })
    .refine((value) => value.name !== undefined || value.timezone !== undefined, {
      message: 'Provide a name or timezone',
    }),
  query: emptyObject,
  params: emptyObject,
});

export const userRoutes = Router();

userRoutes.use(requireAuth);
userRoutes.get('/me', getMe);
userRoutes.patch('/me', validate(patchSchema), patchMe);
