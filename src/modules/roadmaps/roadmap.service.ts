import { ClientSession, Types } from 'mongoose';
import { ApiError, notFound } from '../../utils/ApiError';
import { addDays, localToday, toScheduledDate } from '../../utils/dates';
import { withOptionalTransaction, withSession } from '../../utils/transaction';
import { GoalModel } from '../goals/goal.model';
import { recordGoalEvent, requireOwnedGoal } from '../goals/goal.service';
import { MilestoneModel } from '../milestones/milestone.model';
import { TaskModel } from '../tasks/task.model';
import { UserModel } from '../users/user.model';
import { RoadmapModel } from './roadmap.model';
import { GeneratedRoadmap } from './roadmap.validation';

export async function saveDraftRoadmap(input: {
  userId: string;
  goalId: string;
  plan: GeneratedRoadmap;
  source: 'gemini' | 'mock';
  dailyMinutes: number;
}) {
  const goal = await requireOwnedGoal(input.userId, input.goalId);
  if (goal.status === 'archived') {
    throw new ApiError(409, 'Archived goals cannot receive a roadmap');
  }

  const latest = await RoadmapModel.findOne({ userId: input.userId, goalId: goal._id }).sort({ version: -1 });
  const version = (latest?.version ?? 0) + 1;

  const roadmap = await withOptionalTransaction(async (session) => {
    const options = withSession(session);
    const [created] = await RoadmapModel.create(
      [
        {
          userId: input.userId,
          goalId: goal._id,
          version,
          status: 'draft',
          title: input.plan.goal.title,
          category: input.plan.goal.category,
          durationDays: input.plan.goal.durationDays,
          dailyMinutes: input.dailyMinutes,
          source: input.source,
        },
      ],
      options,
    );

    for (const milestone of [...input.plan.milestones].sort((a, b) => a.sequence - b.sequence)) {
      const [savedMilestone] = await MilestoneModel.create(
        [
          {
            userId: input.userId,
            goalId: goal._id,
            roadmapId: created._id,
            title: milestone.title,
            description: milestone.description ?? '',
            sequence: milestone.sequence,
            status: 'pending',
          },
        ],
        options,
      );

      await TaskModel.insertMany(
        milestone.tasks.map((task) => ({
          userId: new Types.ObjectId(input.userId),
          goalId: goal._id,
          roadmapId: created._id,
          milestoneId: savedMilestone._id,
          day: task.day,
          title: task.title,
          durationMinutes: task.durationMinutes,
          priority: task.priority,
          instructions: task.instructions,
          completionCriteria: task.completionCriteria,
          status: 'pending',
          isActive: false,
        })),
        session ? { session } : {},
      );
    }

    await recordInSession(session, input.userId, goal.id, 'roadmap_draft_created', `Roadmap version ${version} saved as a draft`, {
      roadmapId: created.id,
      version,
    });

    return created;
  });

  return getRoadmap(input.userId, roadmap.id);
}

export async function listRoadmaps(userId: string, goalId?: string) {
  const filter: { userId: string; goalId?: string } = { userId };
  if (goalId) {
    await requireOwnedGoal(userId, goalId);
    filter.goalId = goalId;
  }
  const roadmaps = await RoadmapModel.find(filter).sort({ createdAt: -1 });
  return Promise.all(roadmaps.map((roadmap) => presentRoadmap(roadmap.id, false)));
}

export async function getRoadmap(userId: string, roadmapId: string) {
  const roadmap = await RoadmapModel.findOne({ _id: roadmapId, userId });
  if (!roadmap) throw notFound('Roadmap');
  return presentRoadmap(roadmap.id, true);
}

export async function approveRoadmap(userId: string, roadmapId: string, startDate?: string) {
  const roadmap = await RoadmapModel.findOne({ _id: roadmapId, userId });
  if (!roadmap) throw notFound('Roadmap');
  if (roadmap.status !== 'draft') {
    throw new ApiError(409, 'Only a draft roadmap can be approved');
  }

  const goal = await GoalModel.findOne({ _id: roadmap.goalId, userId });
  if (!goal) throw notFound('Goal');
  if (goal.status === 'archived') {
    throw new ApiError(409, 'Archived goals cannot accept a roadmap');
  }

  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User');

  const start = startDate ?? localToday(user.timezone);
  const end = addDays(start, roadmap.durationDays - 1, user.timezone);
  if (goal.targetDate && end > goal.targetDate) {
    throw new ApiError(
      409,
      'This schedule ends after the approved deadline. Replan without moving the deadline.',
    );
  }

  const tasks = await TaskModel.find({ roadmapId: roadmap._id, userId });
  const previous = await RoadmapModel.find({
    goalId: goal._id,
    userId,
    status: 'approved',
    _id: { $ne: roadmap._id },
  });

  await withOptionalTransaction(async (session) => {
    const options = withSession(session);
    if (previous.length > 0) {
      const previousIds = previous.map((item) => item._id);
      await RoadmapModel.updateMany(
        { _id: { $in: previousIds } },
        { $set: { status: 'superseded', supersededAt: new Date() } },
        options,
      );
      await TaskModel.updateMany(
        {
          roadmapId: { $in: previousIds },
          status: { $in: ['pending', 'in_progress', 'missed', 'skipped'] },
        },
        { $set: { status: 'superseded', isActive: false } },
        options,
      );
    }

    for (const task of tasks) {
      const taskDate = addDays(start, task.day - 1, user.timezone);
      await TaskModel.updateOne(
        { _id: task._id },
        {
          $set: {
            taskDate,
            scheduledDate: toScheduledDate(taskDate, user.timezone),
            isActive: true,
            status: 'pending',
          },
        },
        options,
      );
    }

    roadmap.status = 'approved';
    roadmap.approvedAt = new Date();
    roadmap.startDate = start;
    roadmap.endDate = end;
    await roadmap.save(options);

    goal.activeRoadmapId = roadmap._id;
    goal.startDate = goal.startDate ?? start;
    if (goal.status === 'draft' || goal.status === 'paused') {
      goal.status = 'active';
      goal.pausedAt = null;
    }
    goal.progressPercent = 0;
    await goal.save(options);

    await recordInSession(session, userId, goal.id, 'roadmap_approved', `Roadmap version ${roadmap.version} approved`, {
      roadmapId: roadmap.id,
      startDate: start,
      endDate: end,
    });
  });

  return getRoadmap(userId, roadmap.id);
}

async function presentRoadmap(roadmapId: string, includeTasks: boolean) {
  const roadmap = await RoadmapModel.findById(roadmapId);
  if (!roadmap) throw notFound('Roadmap');
  const milestones = await MilestoneModel.find({ roadmapId: roadmap._id }).sort({ sequence: 1 });
  const tasks = includeTasks ? await TaskModel.find({ roadmapId: roadmap._id }).sort({ day: 1 }) : [];

  return {
    id: roadmap.id,
    goalId: roadmap.goalId.toString(),
    version: roadmap.version,
    status: roadmap.status,
    title: roadmap.title,
    category: roadmap.category,
    durationDays: roadmap.durationDays,
    dailyMinutes: roadmap.dailyMinutes,
    source: roadmap.source,
    startDate: roadmap.startDate ?? null,
    endDate: roadmap.endDate ?? null,
    approvedAt: roadmap.approvedAt,
    createdAt: roadmap.createdAt,
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      sequence: milestone.sequence,
      status: milestone.status,
      tasks: tasks
        .filter((task) => task.milestoneId.equals(milestone._id))
        .map((task) => ({
          id: task.id,
          day: task.day,
          taskDate: task.taskDate ?? null,
          title: task.title,
          durationMinutes: task.durationMinutes,
          priority: task.priority,
          instructions: task.instructions,
          completionCriteria: task.completionCriteria,
          status: task.status,
          isActive: task.isActive,
        })),
    })),
  };
}

async function recordInSession(
  session: ClientSession | null,
  userId: string,
  goalId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown>,
) {
  if (session) {
    const { GoalEventModel } = await import('../goals/goal-event.model');
    await GoalEventModel.create([{ userId, goalId, type, message, metadata }], { session });
    return;
  }
  await recordGoalEvent(userId, goalId, type, message, metadata);
}
