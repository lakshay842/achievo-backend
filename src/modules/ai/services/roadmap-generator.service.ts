import { getAiProvider } from '../../../config/ai';
import { ApiError } from '../../../utils/ApiError';
import { AiError } from '../providers/ai-error';
import { getAssessment } from '../../assessments/assessment.service';
import { requireOwnedGoal } from '../../goals/goal.service';
import { getRoadmap, saveDraftRoadmap } from '../../roadmaps/roadmap.service';
import { parseGeneratedRoadmap } from '../../roadmaps/roadmap.validation';
import { parseAiJson } from '../ai.json';

const system = `You are ACHIEVO, a planning coach. Return only JSON for a roadmap.
Never shame the user.
Quality rules:
- Every task title must be a specific action for THIS goal (skill, exercise, or deliverable).
- Forbidden titles: anything like "day 1", "day 2", "{goal} day N", "task N", or generic filler.
- Each task needs 2–4 concrete instructions and 1–2 observable completion criteria.
- Milestones should name a real learning/progress theme, not "milestone 1".
- Progression must go fundamentals → practice → application across the days.
Structure rules:
- durationDays must match the requested duration.
- Include every day from 1 through durationDays.
- Milestone sequences start at 1 and increase by 1.
- Each milestone covers a contiguous day range, and the next milestone starts the following day.
- A day belongs to one milestone.
- Task titles are unique within a day.
- The sum of durationMinutes on a day must be less than or equal to the daily minute limit.
- Do not extend the deadline.
Schema:
{"goal":{"title":"string","durationDays":1,"category":"string"},"milestones":[{"title":"string","sequence":1,"description":"string","tasks":[{"day":1,"title":"string","durationMinutes":30,"priority":"high","instructions":["string"],"completionCriteria":["string"]}]}]}`;

export async function generateRoadmap(userId: string, goalId: string) {
  const goal = await requireOwnedGoal(userId, goalId);
  const assessment = await getAssessment(userId, goal.id);
  if (assessment?.status === 'needs_clarification') {
    throw new ApiError(422, 'Answer the clarification questions before generating a roadmap');
  }

  const provider = getAiProvider();
  const context = {
    title: goal.title,
    description: goal.description,
    category: goal.category || 'personal',
    currentLevel: goal.currentLevel,
    desiredOutcome: goal.desiredOutcome,
    durationDays: goal.durationDays,
    dailyMinutes: goal.availableMinutesPerDay,
    summary: assessment?.summary ?? '',
  };

  const { plan, source } = await requestValidRoadmap(context, async (repairErrors) =>
    provider.complete({
      purpose: 'roadmap',
      system,
      user: JSON.stringify({ ...context, repairErrors }),
      json: true,
      temperature: 0.35,
      context,
    }),
  );

  return saveDraftRoadmap({
    userId,
    goalId: goal.id,
    plan,
    source: source ?? provider.name,
    dailyMinutes: goal.availableMinutesPerDay,
  });
}

type RoadmapContext = {
  title?: string;
  category?: string;
  durationDays: number;
  dailyMinutes: number;
  currentLevel?: string;
  desiredOutcome?: string;
  description?: string;
  summary?: string;
};

export async function requestValidRoadmap(
  context: RoadmapContext,
  complete: (repairErrors?: string) => Promise<string>,
): Promise<{ plan: Awaited<ReturnType<typeof parseGeneratedRoadmap>>; source?: string }> {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await complete(attempt === 0 ? undefined : lastError);
    try {
      const plan = parseGeneratedRoadmap(parseAiJson(text), {
        durationDays: context.durationDays,
        dailyMinutes: context.dailyMinutes,
      });
      if (looksGenericRoadmap(plan, context.title ?? '')) {
        lastError =
          'Task titles look generic (day N / milestone N). Rewrite with specific skill-based actions, instructions, and completion criteria.';
        continue;
      }
      return { plan };
    } catch (error) {
      if (error instanceof AiError && error.code !== 'INVALID_RESPONSE') throw error;
      lastError = error instanceof Error ? error.message : 'Invalid roadmap';
    }
  }

  // Last resort: topic-aware deterministic plan so goal creation never hard-fails.
  const { buildMockRoadmap } = await import('../providers/mock.provider');
  return {
    plan: buildMockRoadmap({
      title: context.title ?? 'Goal',
      category: context.category ?? 'personal',
      durationDays: context.durationDays,
      dailyMinutes: context.dailyMinutes,
      currentLevel: context.currentLevel,
      desiredOutcome: context.desiredOutcome,
      description: context.description,
      summary: context.summary,
    }),
    source: 'mock',
  };
}

function looksGenericRoadmap(
  plan: Awaited<ReturnType<typeof parseGeneratedRoadmap>>,
  goalTitle: string,
): boolean {
  const escaped = goalTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const genericTitle = new RegExp(
    `^(day\\s*\\d+|task\\s*\\d+|${escaped}\\s*day\\s*\\d+|${escaped}\\s*milestone\\s*\\d+)$`,
    'i',
  );
  const tasks = plan.milestones.flatMap((milestone) => milestone.tasks);
  if (tasks.length === 0) return true;
  const genericCount = tasks.filter((task) => genericTitle.test(task.title.trim())).length;
  return genericCount >= Math.ceil(tasks.length * 0.5);
}

export async function loadOwnedRoadmap(userId: string, roadmapId: string) {
  return getRoadmap(userId, roadmapId);
}
