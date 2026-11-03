import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { openApiSpec } from './docs/swagger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiRateLimit } from './middleware/rate-limit.middleware';
import { aiRoutes } from './modules/ai/ai.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { coachRoutes } from './modules/coach/coach.routes';
import { goalRoutes } from './modules/goals/goal.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { progressRoutes } from './modules/progress/progress.routes';
import { roadmapRoutes } from './modules/roadmaps/roadmap.routes';
import { taskRoutes } from './modules/tasks/task.routes';
import { userRoutes } from './modules/users/user.routes';
import { ApiError } from './utils/ApiError';
import { asyncHandler } from './utils/asyncHandler';
import { logger } from './utils/logger';

export const app = express();

app.set('trust proxy', env.isProduction ? 1 : false);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    let database: 'connected' | 'disconnected' = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    if (database === 'connected' && mongoose.connection.db) {
      try {
        await mongoose.connection.db.command({ ping: 1 });
      } catch {
        database = 'disconnected';
      }
    }

    const healthy = database === 'connected';
    res.status(healthy ? 200 : 503).json({
      success: healthy,
      message: healthy ? 'Healthy' : 'Database unavailable',
      data: {
        status: healthy ? 'ok' : 'degraded',
        database,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        aiMode: env.mockAi ? 'mock' : 'gemini',
      },
    });
  }),
);

app.get('/api-docs.json', (_req, res) => {
  res.json(openApiSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api/v1', apiRateLimit);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/roadmaps', roadmapRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/coach', coachRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
