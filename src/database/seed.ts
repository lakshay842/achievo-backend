import { connectDatabase, disconnectDatabase } from '../config/database';
import { register } from '../modules/auth/auth.service';
import { createGoal } from '../modules/goals/goal.service';
import { logger } from '../utils/logger';

async function seed() {
  await connectDatabase();
  try {
    const account = await register({
      name: 'Demo Learner',
      email: 'demo@achievo.local',
      password: 'Password123!',
      timezone: 'UTC',
    });
    await createGoal(account.user.id, {
      title: 'Learn Java',
      description: 'I can write small programs and want a daily practice plan.',
      category: 'education',
      availableMinutesPerDay: 60,
      durationDays: 14,
    });
    logger.info('Seed user demo@achievo.local is ready');
  } catch (error) {
    logger.info({ message: error instanceof Error ? error.message : 'seed skipped' }, 'Seed did not create a new user');
  } finally {
    await disconnectDatabase();
  }
}

seed().catch((error: unknown) => {
  logger.error({ message: error instanceof Error ? error.message : 'seed failed' }, 'Seed failed');
  process.exit(1);
});
