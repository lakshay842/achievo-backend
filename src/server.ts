import { createServer } from 'http';
import { app } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { startNotificationScheduler, stopNotificationScheduler } from './jobs/notification.scheduler';
import { logger } from './utils/logger';

async function shutdown(server: ReturnType<typeof createServer>, signal: string) {
  logger.info({ signal }, 'Shutting down');
  stopNotificationScheduler();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await disconnectDatabase();
}

async function main() {
  await connectDatabase();
  const server = createServer(app);

  if (!env.isTest) {
    startNotificationScheduler();
  }

  await new Promise<void>((resolve) => {
    server.listen(env.port, '0.0.0.0', () => {
      logger.info({ port: env.port, env: env.nodeEnv, aiMode: env.mockAi ? 'mock' : 'gemini' }, 'ACHIEVO API listening');
      resolve();
    });
  });

  const onSignal = (signal: string) => {
    shutdown(server, signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ message: error instanceof Error ? error.message : 'shutdown failed' }, 'Shutdown failed');
        process.exit(1);
      });
  };

  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    logger.error({ message: error instanceof Error ? error.message : 'startup failed' }, 'Failed to start server');
    process.exit(1);
  });
}
