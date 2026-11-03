import { getAiProvider } from '../../../config/ai';
import { ApiError, notFound } from '../../../utils/ApiError';
import { localToday } from '../../../utils/dates';
import { requireOwnedGoal } from '../../goals/goal.service';
import { RoadmapModel } from '../../roadmaps/roadmap.model';
import { saveDraftRoadmap } from '../../roadmaps/roadmap.service';
import { TaskModel } from '../../tasks/task.model';
import { UserModel } from '../../users/user.model';
import { requestValidRoadmap } from './roadmap-generator.service';

const system = `You are ACHIEVO, a planning coach revising an existing roadmap. Return only JSON.
Do not delete history in your response. Return a full replacement draft with the same durationDays.
Do not move the deadline. Keep every day filled, milestones contiguous, and daily minutes inside the limit.
Use the missed tasks, completed work, and difficulty feedback to make the next draft more realistic.
Task titles must be specific actions — never "day N" or "{goal} day N".
Never shame the user.`;

export async function replanRoadmap(userId: string, roadmapId: string) {
  const roadmap = await RoadmapModel.findOne({ _id: roadmapId, userId });
  if (!roadmap) throw notFound('Roadmap');
  if (roadmap.status === 'superseded') {
    throw new ApiError(409, 'Replan the current draft or approved roadmap');
  }

  const goal = await requireOwnedGoal(userId, roadmap.goalId.toString());
  const user = await UserModel.findById(userId);
  const tasks = await TaskModel.find({ roadmapId: roadmap._id, userId });
  const today = localToday(user?.timezone ?? 'UTC');

  const context = {
    title: goal.title,
    category: goal.category || roadmap.category,
    durationDays: goal.durationDays,
    dailyMinutes: goal.availableMinutesPerDay,
    desiredOutcome: goal.desiredOutcome,
    description: goal.description,
    currentLevel: goal.currentLevel,
    targetDate: goal.targetDate ?? null,
    today,
    completed: tasks.filter((task) => task.status === 'completed').map((task) => task.title),
    missed: tasks.filter((task) => task.status === 'missed').map((task) => task.title),
    feedback: tasks
      .filter((task) => task.difficultyFeedback)
      .map((task) => ({ title: task.title, difficulty: task.difficultyFeedback })),
  };

  const provider = getAiProvider();
  const { plan, source } = await requestValidRoadmap(context, async (repairErrors) =>
    provider.complete({
      purpose: 'replan',
      system,
      user: JSON.stringify({ ...context, repairErrors, instruction: 'Keep durationDays unchanged.' }),
      json: true,
      temperature: 0.3,
      context,
    }),
  );

  const draft = await saveDraftRoadmap({
    userId,
    goalId: goal.id,
    plan,
    source: source ?? provider.name,
    dailyMinutes: goal.availableMinutesPerDay,
  });

  return {
    ...draft,
    requiresApproval: true,
    previousRoadmapId: roadmap.id,
    note: 'This is a draft. The approved schedule stays unchanged until you approve this version.',
  };
}
