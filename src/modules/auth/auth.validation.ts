import { z } from 'zod';
import { emptyObject, passwordSchema, timezoneSchema } from '../../utils/zod';

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(80),
    email: emailSchema,
    password: passwordSchema,
    timezone: timezoneSchema.optional(),
  }),
  query: emptyObject,
  params: emptyObject,
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  }),
  query: emptyObject,
  params: emptyObject,
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
  query: emptyObject,
  params: emptyObject,
});

export const logoutSchema = refreshSchema;

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
  query: emptyObject,
  params: emptyObject,
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    password: passwordSchema,
  }),
  query: emptyObject,
  params: emptyObject,
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
