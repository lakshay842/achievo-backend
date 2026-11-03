import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { emptyObject, paginationQuerySchema, timeSchema } from '../../utils/zod';
import {
  deviceTokenHandler,
  listHandler,
  motivationPushHandler,
  preferencesHandler,
  testHandler,
} from './notification.controller';

const tokenSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1).max(255),
    platform: z.enum(['ios', 'android', 'unknown']).optional(),
  }),
  query: emptyObject,
  params: emptyObject,
});

const listSchema = z.object({
  body: emptyObject,
  query: paginationQuerySchema,
  params: emptyObject,
});

const preferencesSchema = z.object({
  body: z
    .object({
      notificationsEnabled: z.boolean().optional(),
      dailyReminder: z.boolean().optional(),
      dailyReminderTime: timeSchema.optional(),
      taskReminder: z.boolean().optional(),
      motivation: z.boolean().optional(),
      milestoneCelebration: z.boolean().optional(),
      missedTask: z.boolean().optional(),
      deadlineReminder: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: 'Provide a preference to update' }),
  query: emptyObject,
  params: emptyObject,
});

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);
notificationRoutes.post('/device-token', validate(tokenSchema), deviceTokenHandler);
notificationRoutes.get('/', validate(listSchema), listHandler);
notificationRoutes.patch('/preferences', validate(preferencesSchema), preferencesHandler);
notificationRoutes.post('/test', testHandler);
notificationRoutes.post('/motivation', motivationPushHandler);
