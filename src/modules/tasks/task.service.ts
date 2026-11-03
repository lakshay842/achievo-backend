import { FilterQuery } from 'mongoose';
import { ApiError, notFound } from '../../utils/ApiError';
import { diffLocalDays, localToday } from '../../utils/dates';
import { getPagination, pageMeta } from '../../utils/pagination';
import { enqueueNotification } from '../notifications/notification.service';
import { UserPreferenceModel } from '../users/user-preference.model';
import { MilestoneModel } from '../milestones/milestone.model';
import { reconcileMissedTasks, recordCompletionStreak, refreshGoalProgress } from '../progress/progress.service';
import { RoadmapModel } from '../roadmaps/roadmap.model';
import { UserModel } from '../users/user.model';
import { ITask, TaskModel, TaskStatus } from './task.model';
import { TaskProgressModel } from './task-progress.model';

export function toTaskDto(task: ITask) {
  return {
    id: task._id.toString(),
    goalId: task.goalId.toString(),
    roadmapId: task.roadmapId.toString(),
    milestoneId: task.milestoneId.toString(),
    day: task.day,
    taskDate: task.taskDate ?? null,
    title: task.title,
    durationMinutes: task.durationMinutes,
    priority: task.priority,
    instructions: task.instructions,
    completionCriteria: task.completionCriteria,
    status: task.status,
    isActive: task.isActive,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    difficultyFeedback: task.difficultyFeedback ?? null,
    feedbackNote: task.feedbackNote ?? null,
  };
}

export async function listTasks(
  userId: string,
  query: { status?: TaskStatus; goalId?: string; from?: string; to?: string; page?: number; limit?: number },
) {
  const user = await requireUser(userId);
  await reconcileMissedTasks(userId, user.timezone);
  const { page, limit, skip } = getPagination(query);
  const filter: FilterQuery<ITask> = { userId };
  if (query.status) filter.status = query.status;
  if (query.goalId) filter.goalId = query.goalId;
  if (query.from || query.to) {
    filter.taskDate = {};
    if (query.from) filter.taskDate.$gte = query.from;
    if (query.to) filter.taskDate.$lte = query.to;
  }
  const [tasks, total] = await Promise.all([
    TaskModel.find(filter).sort({ taskDate: 1, day: 1 }).skip(skip).limit(limit),
    TaskModel.countDocuments(filter),
  ]);
  return { items: tasks.map(toTaskDto), meta: pageMeta(total, page, limit) };
}

export async function tasksForToday(userId: string, now = new Date()) {
  const user = await requireUser(userId);
  await reconcileMissedTasks(userId, user.timezone, now);
  const today = localToday(user.timezone, now);
  const tasks = await TaskModel.find({
    userId,
    taskDate: today,
    isActive: true,
    status: { $in: ['pending', 'in_progress'] },
  }).sort({ day: 1 });
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  tasks.sort((left, right) => (rank[left.priority] ?? 1) - (rank[right.priority] ?? 1) || left.day - right.day);
  return { date: today, tasks: tasks.map(toTaskDto) };
}

export async function getTask(userId: string, taskId: string) {
  const task = await requireOwnedTask(userId, taskId);
  return toTaskDto(task);
}

export async function startTask(userId: string, taskId: string) {
  const started = await TaskModel.findOneAndUpdate(
    { _id: taskId, userId, isActive: true, status: 'pending' },
    { $set: { status: 'in_progress', startedAt: new Date() } },
    { new: true },
  );
  if (started) {
    await recordProgress(userId, started, 'start');
    return toTaskDto(started);
  }

  const existing = await requireOwnedTask(userId, taskId);
  if (existing.status === 'in_progress') return toTaskDto(existing);
  throw new ApiError(409, `Task cannot be started from status ${existing.status}`);
}

export async function completeTask(userId: string, taskId: string, now = new Date()) {
  const completed = await TaskModel.findOneAndUpdate(
    { _id: taskId, userId, status: { $in: ['pending', 'in_progress'] } },
    { $set: { status: 'completed', completedAt: now, isActive: true } },
    { new: true },
  );

  if (!completed) {
    const existing = await requireOwnedTask(userId, taskId);
    if (existing.status === 'completed') {
      throw new ApiError(409, 'Task is already completed');
    }
    throw new ApiError(409, `Task cannot be completed from status ${existing.status}`);
  }

  await recordProgress(userId, completed, 'complete');
  const user = await requireUser(userId);
  await refreshGoalProgress(userId, completed.goalId.toString());
  await recordCompletionStreak(userId, user.timezone, now);
  await celebrateMilestone(userId, completed);
  return toTaskDto(completed);
}

export async function skipTask(userId: string, taskId: string) {
  const skipped = await TaskModel.findOneAndUpdate(
    { _id: taskId, userId, status: { $in: ['pending', 'in_progress', 'missed'] } },
    { $set: { status: 'skipped' } },
    { new: true },
  );
  if (!skipped) {
    const existing = await requireOwnedTask(userId, taskId);
    throw new ApiError(409, `Task cannot be skipped from status ${existing.status}`);
  }
  await recordProgress(userId, skipped, 'skip');
  await refreshGoalProgress(userId, skipped.goalId.toString());
  return toTaskDto(skipped);
}

export async function rescheduleTask(userId: string, taskId: string, taskDate: string) {
  const user = await requireUser(userId);
  const task = await requireOwnedTask(userId, taskId);
  if (!task.isActive || !task.taskDate) {
    throw new ApiError(409, 'Only scheduled tasks can be rescheduled');
  }
  if (task.status === 'completed' || task.status === 'superseded') {
    throw new ApiError(409, `Task cannot be rescheduled from status ${task.status}`);
  }

  const roadmap = await RoadmapModel.findOne({ _id: task.roadmapId, userId });
  if (!roadmap?.startDate || !roadmap.endDate) {
    throw new ApiError(409, 'Task is not on an approved schedule');
  }

  const shift = Math.abs(diffLocalDays(task.taskDate, taskDate, user.timezone));
  if (shift > 7 || taskDate < roadmap.startDate || taskDate > roadmap.endDate) {
    throw new ApiError(
      409,
      'This is a significant schedule change. Review a replanned roadmap and approve it before it is applied.',
    );
  }

  const previousDate = task.taskDate;
  task.taskDate = taskDate;
  task.scheduledDate = new Date(`${taskDate}T00:00:00.000Z`);
  if (task.status === 'missed' || task.status === 'skipped') task.status = 'pending';
  await task.save();
  await recordProgress(userId, task, 'reschedule', { from: previousDate, to: taskDate });
  return toTaskDto(task);
}

export async function saveFeedback(
  userId: string,
  taskId: string,
  input: { difficulty: 'easy' | 'moderate' | 'hard'; note?: string },
) {
  const task = await requireOwnedTask(userId, taskId);
  task.difficultyFeedback = input.difficulty;
  task.feedbackNote = input.note;
  await task.save();
  await recordProgress(userId, task, 'feedback', { difficulty: input.difficulty });
  return toTaskDto(task);
}

export async function requireOwnedTask(userId: string, taskId: string) {
  const task = await TaskModel.findOne({ _id: taskId, userId });
  if (!task) throw notFound('Task');
  return task;
}

async function recordProgress(
  userId: string,
  task: ITask,
  type: 'start' | 'complete' | 'skip' | 'reschedule' | 'feedback',
  metadata?: Record<string, unknown>,
) {
  try {
    await TaskProgressModel.create({
      userId,
      taskId: task._id,
      goalId: task.goalId,
      type,
      metadata,
    });
  } catch (error) {
    if (type === 'complete' && isDuplicate(error)) return;
    throw error;
  }
}

async function celebrateMilestone(userId: string, task: ITask) {
  const remaining = await TaskModel.countDocuments({
    milestoneId: task.milestoneId,
    isActive: true,
    status: { $ne: 'completed' },
  });
  if (remaining > 0) return;
  await MilestoneModel.updateOne({ _id: task.milestoneId }, { $set: { status: 'completed' } });
  const preferences = await UserPreferenceModel.findOne({ userId });
  if (!preferences?.notificationsEnabled || !preferences.milestoneCelebration) return;
  const milestone = await MilestoneModel.findById(task.milestoneId);
  await enqueueNotification({
    userId,
    type: 'milestone_celebration',
    title: 'Milestone complete',
    body: `You finished ${milestone?.title ?? 'a milestone'}. Take a moment to notice the progress.`,
    dedupeKey: `milestone:${task.milestoneId.toString()}`,
    data: { milestoneId: task.milestoneId.toString(), goalId: task.goalId.toString() },
  });
}

async function requireUser(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User');
  return user;
}

function isDuplicate(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
}
