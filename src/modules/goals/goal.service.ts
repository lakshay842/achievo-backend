import { FilterQuery } from 'mongoose';
import { ApiError, notFound } from '../../utils/ApiError';
import { pageMeta, getPagination } from '../../utils/pagination';
import { AssessmentModel } from '../assessments/assessment.model';
import { MilestoneModel } from '../milestones/milestone.model';
import { RoadmapModel } from '../roadmaps/roadmap.model';
import { TaskProgressModel } from '../tasks/task-progress.model';
import { TaskModel } from '../tasks/task.model';
import { GoalEventModel } from './goal-event.model';
import { GoalModel, GoalStatus, IGoal } from './goal.model';

export interface GoalWriteInput {
  title: string;
  description?: string;
  category?: string;
  currentLevel?: string;
  desiredOutcome?: string;
  availableMinutesPerDay: number;
  durationDays: number;
  startDate?: string;
  targetDate?: string;
}

export function toGoalDto(goal: IGoal) {
  return {
    id: goal._id.toString(),
    title: goal.title,
    description: goal.description,
    category: goal.category,
    status: goal.status,
    currentLevel: goal.currentLevel,
    desiredOutcome: goal.desiredOutcome,
    availableMinutesPerDay: goal.availableMinutesPerDay,
    durationDays: goal.durationDays,
    startDate: goal.startDate ?? null,
    targetDate: goal.targetDate ?? null,
    progressPercent: goal.progressPercent,
    activeRoadmapId: goal.activeRoadmapId ? goal.activeRoadmapId.toString() : null,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

export async function createGoal(userId: string, input: GoalWriteInput) {
  assertDateOrder(input.startDate, input.targetDate);
  const goal = await GoalModel.create({
    userId,
    title: input.title,
    description: input.description ?? '',
    category: input.category ?? 'personal',
    currentLevel: input.currentLevel ?? '',
    desiredOutcome: input.desiredOutcome ?? '',
    availableMinutesPerDay: input.availableMinutesPerDay,
    durationDays: input.durationDays,
    startDate: input.startDate,
    targetDate: input.targetDate,
    status: 'draft',
  });
  await recordGoalEvent(userId, goal.id, 'created', 'Goal created');
  return toGoalDto(goal);
}

export async function listGoals(
  userId: string,
  query: { status?: GoalStatus; page?: number; limit?: number },
) {
  const { page, limit, skip } = getPagination(query);
  const filter: FilterQuery<IGoal> = { userId };
  if (query.status) filter.status = query.status;
  const [goals, total] = await Promise.all([
    GoalModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    GoalModel.countDocuments(filter),
  ]);
  return { items: goals.map(toGoalDto), meta: pageMeta(total, page, limit) };
}

export async function getGoal(userId: string, goalId: string) {
  const goal = await requireOwnedGoal(userId, goalId);
  return toGoalDto(goal);
}

export async function updateGoal(userId: string, goalId: string, input: Partial<GoalWriteInput>) {
  const goal = await requireOwnedGoal(userId, goalId);
  if (goal.status === 'archived') {
    throw new ApiError(409, 'Archived goals cannot be edited');
  }
  const startDate = input.startDate ?? goal.startDate;
  const targetDate = input.targetDate ?? goal.targetDate;
  assertDateOrder(startDate, targetDate);

  if (input.title !== undefined) goal.title = input.title;
  if (input.description !== undefined) goal.description = input.description;
  if (input.category !== undefined) goal.category = input.category;
  if (input.currentLevel !== undefined) goal.currentLevel = input.currentLevel;
  if (input.desiredOutcome !== undefined) goal.desiredOutcome = input.desiredOutcome;
  if (input.availableMinutesPerDay !== undefined) goal.availableMinutesPerDay = input.availableMinutesPerDay;
  if (input.durationDays !== undefined) goal.durationDays = input.durationDays;
  if (input.startDate !== undefined) goal.startDate = input.startDate;
  if (input.targetDate !== undefined) goal.targetDate = input.targetDate;
  await goal.save();
  await recordGoalEvent(userId, goal.id, 'updated', 'Goal updated');
  return toGoalDto(goal);
}

export async function pauseGoal(userId: string, goalId: string) {
  const goal = await requireOwnedGoal(userId, goalId);
  if (goal.status !== 'active') throw new ApiError(409, 'Only an active goal can be paused');
  goal.status = 'paused';
  goal.pausedAt = new Date();
  await goal.save();
  await recordGoalEvent(userId, goal.id, 'paused', 'Goal paused');
  return toGoalDto(goal);
}

export async function resumeGoal(userId: string, goalId: string) {
  const goal = await requireOwnedGoal(userId, goalId);
  if (goal.status !== 'paused') throw new ApiError(409, 'Only a paused goal can be resumed');
  goal.status = 'active';
  goal.pausedAt = null;
  await goal.save();
  await recordGoalEvent(userId, goal.id, 'resumed', 'Goal resumed');
  return toGoalDto(goal);
}

export async function archiveGoal(userId: string, goalId: string) {
  const goal = await requireOwnedGoal(userId, goalId);
  if (goal.status === 'archived') throw new ApiError(409, 'Goal is already archived');
  goal.status = 'archived';
  goal.archivedAt = new Date();
  await goal.save();
  await recordGoalEvent(userId, goal.id, 'archived', 'Goal archived');
  return toGoalDto(goal);
}

export async function activateGoal(userId: string, goalId: string) {
  const goal = await requireOwnedGoal(userId, goalId);
  if (goal.status !== 'archived') {
    throw new ApiError(409, 'Only an archived goal can be activated');
  }
  goal.status = 'active';
  goal.archivedAt = null;
  goal.pausedAt = null;
  await goal.save();
  await recordGoalEvent(userId, goal.id, 'activated', 'Goal activated from archive');
  return toGoalDto(goal);
}

export async function deleteGoal(userId: string, goalId: string) {
  const goal = await requireOwnedGoal(userId, goalId);
  const id = goal._id;

  await Promise.all([
    TaskProgressModel.deleteMany({ userId, goalId: id }),
    TaskModel.deleteMany({ userId, goalId: id }),
    MilestoneModel.deleteMany({ userId, goalId: id }),
    RoadmapModel.deleteMany({ userId, goalId: id }),
    AssessmentModel.deleteMany({ userId, goalId: id }),
    GoalEventModel.deleteMany({ userId, goalId: id }),
  ]);
  await GoalModel.deleteOne({ _id: id, userId });

  return { id: goalId, deleted: true as const };
}

export async function requireOwnedGoal(userId: string, goalId: string) {
  const goal = await GoalModel.findOne({ _id: goalId, userId });
  if (!goal) throw notFound('Goal');
  return goal;
}

export async function recordGoalEvent(
  userId: string,
  goalId: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  await GoalEventModel.create({ userId, goalId, type, message, metadata });
}

function assertDateOrder(startDate?: string, targetDate?: string) {
  if (startDate && targetDate && targetDate < startDate) {
    throw new ApiError(400, 'Target date must be on or after the start date');
  }
}
