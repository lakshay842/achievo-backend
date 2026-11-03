import { notFound } from '../../utils/ApiError';
import { addDays, localToday, monthEnd, monthStart, weekStart } from '../../utils/dates';
import { GoalModel } from '../goals/goal.model';
import { MilestoneModel } from '../milestones/milestone.model';
import { TaskModel } from '../tasks/task.model';
import { UserModel } from '../users/user.model';
import { UserStreakModel } from './streak.model';

export async function reconcileMissedTasks(userId: string, timeZone: string, now = new Date()) {
  const today = localToday(timeZone, now);
  await TaskModel.updateMany(
    {
      userId,
      isActive: true,
      status: { $in: ['pending', 'in_progress'] },
      taskDate: { $lt: today, $nin: [null, ''] },
    },
    { $set: { status: 'missed' } },
  );
}

export async function refreshGoalProgress(userId: string, goalId: string) {
  const goal = await GoalModel.findOne({ _id: goalId, userId });
  if (!goal) return null;
  if (!goal.activeRoadmapId) {
    goal.progressPercent = 0;
    await goal.save();
    return goal;
  }

  const [total, completed] = await Promise.all([
    TaskModel.countDocuments({ userId, roadmapId: goal.activeRoadmapId, status: { $ne: 'superseded' } }),
    TaskModel.countDocuments({ userId, roadmapId: goal.activeRoadmapId, status: 'completed' }),
  ]);
  goal.progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
  if (goal.progressPercent === 100 && goal.status === 'active') {
    goal.status = 'completed';
  }
  await goal.save();
  return goal;
}

export async function recordCompletionStreak(userId: string, timeZone: string, now = new Date()) {
  const today = localToday(timeZone, now);
  const yesterday = addDays(today, -1, timeZone);
  const streak = await UserStreakModel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { currentStreak: 0, longestStreak: 0 } },
    { upsert: true, new: true },
  );

  if (streak.lastActiveDate === today) return streak;

  const currentStreak = streak.lastActiveDate === yesterday ? streak.currentStreak + 1 : 1;
  streak.currentStreak = currentStreak;
  streak.longestStreak = Math.max(streak.longestStreak, currentStreak);
  streak.lastActiveDate = today;
  await streak.save();
  return streak;
}

export async function getStreak(userId: string) {
  const streak = await UserStreakModel.findOne({ userId });
  return {
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    lastActiveDate: streak?.lastActiveDate ?? null,
  };
}

export async function getOverview(userId: string, now = new Date()) {
  const user = await requireUser(userId);
  await reconcileMissedTasks(userId, user.timezone, now);
  const [completed, pending, missed, skipped, minutes] = await Promise.all([
    TaskModel.countDocuments({ userId, status: 'completed' }),
    TaskModel.countDocuments({ userId, isActive: true, status: { $in: ['pending', 'in_progress'] } }),
    TaskModel.countDocuments({ userId, status: 'missed' }),
    TaskModel.countDocuments({ userId, isActive: true, status: 'skipped' }),
    TaskModel.aggregate<{ total: number }>([
      { $match: { userId: user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$durationMinutes' } } },
    ]),
  ]);
  const denominator = completed + pending + missed + skipped;
  const goals = await GoalModel.find({ userId, status: { $in: ['active', 'paused', 'completed'] } });
  return {
    completedTasks: completed,
    pendingTasks: pending,
    missedTasks: missed,
    skippedTasks: skipped,
    completionPercentage: denominator === 0 ? 0 : Math.round((completed / denominator) * 100),
    timeInvestedMinutes: minutes[0]?.total ?? 0,
    ...(await getStreak(userId)),
    activeGoals: goals.filter((goal) => goal.status === 'active').length,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      status: goal.status,
      progressPercent: goal.progressPercent,
    })),
  };
}

export async function getGoalProgress(userId: string, goalId: string, now = new Date()) {
  const user = await requireUser(userId);
  await reconcileMissedTasks(userId, user.timezone, now);
  const goal = await GoalModel.findOne({ _id: goalId, userId });
  if (!goal) throw notFound('Goal');
  await refreshGoalProgress(userId, goalId);
  const fresh = await GoalModel.findById(goalId);
  if (!fresh) throw notFound('Goal');

  const roadmapFilter = fresh.activeRoadmapId ? { roadmapId: fresh.activeRoadmapId } : { goalId: fresh._id, isActive: true };
  const [completed, pending, missed, minutes, milestones] = await Promise.all([
    TaskModel.countDocuments({ userId, ...roadmapFilter, status: 'completed' }),
    TaskModel.countDocuments({ userId, ...roadmapFilter, status: { $in: ['pending', 'in_progress'] } }),
    TaskModel.countDocuments({ userId, ...roadmapFilter, status: 'missed' }),
    TaskModel.aggregate<{ total: number }>([
      { $match: { userId: user._id, goalId: fresh._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$durationMinutes' } } },
    ]),
    fresh.activeRoadmapId
      ? MilestoneModel.find({ roadmapId: fresh.activeRoadmapId }).sort({ sequence: 1 })
      : Promise.resolve([]),
  ]);
  const milestoneProgress = await Promise.all(
    milestones.map(async (milestone) => {
      const total = await TaskModel.countDocuments({ milestoneId: milestone._id, status: { $ne: 'superseded' } });
      const done = await TaskModel.countDocuments({ milestoneId: milestone._id, status: 'completed' });
      return {
        id: milestone.id,
        title: milestone.title,
        sequence: milestone.sequence,
        status: milestone.status,
        completedTasks: done,
        totalTasks: total,
        progressPercent: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    }),
  );
  const denominator = completed + pending + missed;
  return {
    goalId: fresh.id,
    title: fresh.title,
    status: fresh.status,
    completedTasks: completed,
    pendingTasks: pending,
    missedTasks: missed,
    completionPercentage: denominator === 0 ? 0 : Math.round((completed / denominator) * 100),
    progressPercent: fresh.progressPercent,
    timeInvestedMinutes: minutes[0]?.total ?? 0,
    milestones: milestoneProgress,
  };
}

export async function getWeekly(userId: string, now = new Date()) {
  const user = await requireUser(userId);
  await reconcileMissedTasks(userId, user.timezone, now);
  const start = weekStart(user.timezone, now);
  return buildRange(userId, user.timezone, start, addDays(start, 6, user.timezone));
}

export async function getMonthly(userId: string, now = new Date()) {
  const user = await requireUser(userId);
  await reconcileMissedTasks(userId, user.timezone, now);
  return buildRange(userId, user.timezone, monthStart(user.timezone, now), monthEnd(user.timezone, now));
}

async function buildRange(userId: string, timeZone: string, start: string, end: string) {
  const tasks = await TaskModel.find({
    userId,
    isActive: true,
    taskDate: { $gte: start, $lte: end },
    status: { $ne: 'superseded' },
  });
  const days: Array<{ date: string; completedTasks: number; scheduledTasks: number; minutes: number }> = [];
  let cursor = start;
  while (cursor <= end) {
    const onDay = tasks.filter((task) => task.taskDate === cursor);
    const completed = onDay.filter((task) => task.status === 'completed');
    days.push({
      date: cursor,
      completedTasks: completed.length,
      scheduledTasks: onDay.length,
      minutes: completed.reduce((sum, task) => sum + task.durationMinutes, 0),
    });
    cursor = addDays(cursor, 1, timeZone);
  }
  const completedTasks = days.reduce((sum, day) => sum + day.completedTasks, 0);
  const scheduledTasks = days.reduce((sum, day) => sum + day.scheduledTasks, 0);
  return {
    startDate: start,
    endDate: end,
    timeZone,
    completedTasks,
    scheduledTasks,
    completionPercentage: scheduledTasks === 0 ? 0 : Math.round((completedTasks / scheduledTasks) * 100),
    timeInvestedMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
    days,
  };
}

export async function missedYesterdayCount(userId: string, timeZone: string, now = new Date()) {
  const yesterday = addDays(localToday(timeZone, now), -1, timeZone);
  return TaskModel.countDocuments({ userId, taskDate: yesterday, status: 'missed' });
}

export async function nearestMilestone(userId: string) {
  const goal = await GoalModel.findOne({ userId, status: 'active', activeRoadmapId: { $ne: null } });
  if (!goal?.activeRoadmapId) return null;
  const milestones = await MilestoneModel.find({ roadmapId: goal.activeRoadmapId }).sort({ sequence: 1 });
  for (const milestone of milestones) {
    const total = await TaskModel.countDocuments({ milestoneId: milestone._id, isActive: true });
    if (total === 0) continue;
    const done = await TaskModel.countDocuments({ milestoneId: milestone._id, status: 'completed' });
    const progressPercent = Math.round((done / total) * 100);
    if (progressPercent < 100) {
      return { title: milestone.title, progressPercent };
    }
  }
  return null;
}

async function requireUser(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User');
  return user;
}
