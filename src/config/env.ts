import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    JWT_REFRESH_TTL: z.string().min(1).default('7d'),
    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().min(1),
    GEMINI_FALLBACK_MODELS: z
      .string()
      .optional()
      .default('gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-2.5-flash'),
    MOCK_AI: z.enum(['true', 'false']),
    AI_FALLBACK_TO_MOCK: z.enum(['true', 'false']).optional().default('true'),
    FRONTEND_ORIGIN: z.string().min(1),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).optional().default(2),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
    NOTIFICATIONS_DRY_RUN: z.enum(['true', 'false']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.MOCK_AI === 'false' && value.GEMINI_API_KEY.trim().length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when MOCK_AI is false',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  mongodbUri: raw.MONGODB_URI,
  jwtAccessSecret: raw.JWT_ACCESS_SECRET,
  jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
  jwtAccessTtl: raw.JWT_ACCESS_TTL,
  jwtRefreshTtl: raw.JWT_REFRESH_TTL,
  geminiApiKey: raw.GEMINI_API_KEY.trim(),
  geminiModel: raw.GEMINI_MODEL.trim(),
  geminiFallbackModels: raw.GEMINI_FALLBACK_MODELS.split(',')
    .map((model) => model.trim())
    .filter(Boolean),
  mockAi: raw.MOCK_AI === 'true',
  aiFallbackToMock: raw.AI_FALLBACK_TO_MOCK === 'true',
  frontendOrigins: raw.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  aiTimeoutMs: raw.AI_TIMEOUT_MS,
  aiMaxRetries: raw.AI_MAX_RETRIES,
  logLevel: raw.LOG_LEVEL,
  notificationsDryRun: raw.NOTIFICATIONS_DRY_RUN
    ? raw.NOTIFICATIONS_DRY_RUN === 'true'
    : raw.NODE_ENV !== 'production',
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
};
