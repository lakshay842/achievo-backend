import { localToday } from '../../../utils/dates';
import { TaskModel } from '../../tasks/task.model';
import { UserModel } from '../../users/user.model';
import { getStreak, missedYesterdayCount, nearestMilestone, reconcileMissedTasks } from '../../progress/progress.service';

export interface MotivationMessage {
  tone: 'restart' | 'milestone' | 'consistent' | 'steady';
  message: string;
}

export function composeMotivation(input: {
  currentStreak: number;
  missedYesterday: number;
  milestoneTitle?: string;
  milestonePercent?: number;
  completedToday: number;
}): MotivationMessage {
  if (input.missedYesterday > 0) {
    return {
      tone: 'restart',
      message: "Yesterday didn't go as planned. Let's restart with one small task.",
    };
  }

  if (
    input.milestonePercent !== undefined &&
    input.milestonePercent >= 80 &&
    input.milestonePercent < 100
  ) {
    return {
      tone: 'milestone',
      message: `You are close to completing ${input.milestoneTitle ?? 'your current milestone'}.`,
    };
  }

  if (input.currentStreak >= 3) {
    return {
      tone: 'consistent',
      message: `You have completed ${input.currentStreak} days consistently. Keep moving forward!`,
    };
  }

  if (input.completedToday > 0) {
    return {
      tone: 'steady',
      message: 'You already moved forward today. That is enough to build on.',
    };
  }

  return {
    tone: 'steady',
    message: 'Pick one task you can finish today. Small progress still counts.',
  };
}

export async function motivationForUser(userId: string, now = new Date()): Promise<MotivationMessage> {
  const user = await UserModel.findById(userId);
  if (!user) {
    return composeMotivation({ currentStreak: 0, missedYesterday: 0, completedToday: 0 });
  }
  await reconcileMissedTasks(userId, user.timezone, now);
  const [streak, missedYesterday, milestone, completedToday] = await Promise.all([
    getStreak(userId),
    missedYesterdayCount(userId, user.timezone, now),
    nearestMilestone(userId),
    TaskModel.countDocuments({
      userId,
      status: 'completed',
      taskDate: localToday(user.timezone, now),
    }),
  ]);

  return composeMotivation({
    currentStreak: streak.currentStreak,
    missedYesterday,
    milestoneTitle: milestone?.title,
    milestonePercent: milestone?.progressPercent,
    completedToday,
  });
}
