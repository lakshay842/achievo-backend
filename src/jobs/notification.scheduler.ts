import { logger } from '../utils/logger';
import { processDueNotifications } from './reminder.processor';

let timer: NodeJS.Timeout | null = null;

export function startNotificationScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    processDueNotifications().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Notification scheduler failed';
      logger.error({ message }, 'Notification scheduler failed');
    });
  }, 60_000);
  timer.unref();
  logger.info('Notification scheduler started');
}

export function stopNotificationScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
