import { getAiProvider } from '../../../config/ai';
import { ApiError } from '../../../utils/ApiError';
import { AiError } from '../providers/ai-error';
import { getAssessment } from '../../assessments/assessment.service';
import { requireOwnedGoal } from '../../goals/goal.service';
import { getRoadmap, saveDraftRoadmap } from '../../roadmaps/roadmap.service';
import { parseGeneratedRoadmap } from '../../roadmaps/roadmap.validation';
import { parseAiJson } from '../ai.json';

const system = `You are ACHIEVO, a personal planning coach. Return only JSON for a roadmap.
Never shame the user. Never give medical, legal, or clinical advice. For quitting habits, stay practical and supportive.

CRITICAL: Tasks must match the user's ACTUAL goal from title/description/summary.
- Learning coding / a subject → skill practice, projects, spaced review for THAT subject.
- Quitting cigarettes / vaping → urge plans, trigger maps, replacement routines, environment cleanup, streak proof. NOT studying tobacco.
- Quitting gambling → money barriers, urge delays, alternative dopamine activities, accountability check-ins. NOT "learn about gambling".
- Fitness → workouts, recovery, progressive overload for THEIR activity.
- Career → portfolio, applications, interview drills tied to THEIR target role.
- Finance → budget actions, tracking, concrete money moves.
If the goal is to STOP something, do not generate study/lesson tasks about that topic.

Quality rules:
- Every task title is a specific action for THIS goal (include the skill/habit name when useful).
- Forbidden titles: "day 1", "day 2", "task N", "{goal} day N", "milestone N", "practice session", "study time", generic filler.
- Each task needs 2–3 concrete instructions and 1–2 observable completion criteria.
- Milestone titles name a real theme for this goal (e.g. "Urge toolkit", "Java fundamentals", "Interview stories"), not "Week 1".
- Progression must fit the goal type:
  - skill_learning: fundamentals → guided practice → mini-projects → review
  - habit_quit: awareness/triggers → urge tools → environment & replacement → identity/streak reinforcement
  - habit_build / fitness: easy consistency → progressive challenge → recovery → proof of progress
  - career/finance: setup → daily reps → feedback → shipping outcomes

Structure rules:
- durationDays must match the requested duration.
- Include every day from 1 through durationDays (one primary task per day is preferred).
- Milestone sequences start at 1 and increase by 1.
- Each milestone covers a contiguous day range; the next milestone starts the following day.
- A day belongs to one milestone.
- Task titles are unique within a day; across the plan avoid copy-paste identical titles — vary focus by day.
- Sum of durationMinutes on a day must be <= the daily minute limit.
- Keep instruction lines short so the full plan fits in one response.
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
      user: JSON.stringify({
        instruction:
          'Build a day-by-day roadmap only for this user goal. Mirror their wording. If they want to quit or stop a habit, every day must support quitting that habit with practical actions.',
        goal: context,
        repairErrors,
      }),
      json: true,
      temperature: 0.4,
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
): Promise<{ plan: Awaited<ReturnType<typeof parseGeneratedRoadmap>>; source?: 'gemini' | 'mock' }> {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await complete(attempt === 0 ? undefined : lastError);
    try {
      const plan = parseGeneratedRoadmap(parseAiJson(text), {
        durationDays: context.durationDays,
        dailyMinutes: context.dailyMinutes,
      });
      if (looksGenericRoadmap(plan, context)) {
        lastError =
          'Tasks look generic or off-topic. Rewrite with specific actions for THIS goal (use the skill/habit name). For quit goals use urge/replacement/environment tasks, not study lessons.';
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
  context: RoadmapContext,
): boolean {
  const goalTitle = context.title ?? '';
  const blob = `${goalTitle} ${context.description ?? ''} ${context.summary ?? ''} ${context.desiredOutcome ?? ''}`.toLowerCase();
  const isQuit =
    /\b(quit|stop|give\s*up|giving\s*up|break|avoid|no\s*more|chodna|chod)\b/.test(blob) &&
    /\b(smok\w*|cigar\w*|vape\w*|nicotine|gambl\w*|bet\w*|alcohol|drink\w*|porn|sugar|junk|social\s*media|scrolling)\b/.test(
      blob,
    );

  const escaped = goalTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const genericTitle = new RegExp(
    `^(day\\s*\\d+|task\\s*\\d+|practice\\s*session|study\\s*time|${escaped}\\s*day\\s*\\d+|${escaped}\\s*milestone\\s*\\d+)$`,
    'i',
  );
  const tasks = plan.milestones.flatMap((milestone) => milestone.tasks);
  if (tasks.length === 0) return true;

  const genericCount = tasks.filter((task) => genericTitle.test(task.title.trim())).length;
  if (genericCount >= Math.ceil(tasks.length * 0.4)) return true;

  if (isQuit) {
    const studyLike = tasks.filter((task) =>
      /\b(learn about|study|lesson|chapter|tutorial|course|read about)\b/i.test(
        `${task.title} ${task.instructions.join(' ')}`,
      ),
    ).length;
    if (studyLike >= Math.ceil(tasks.length * 0.35)) return true;
  }

  return false;
}

export async function loadOwnedRoadmap(userId: string, roadmapId: string) {
  return getRoadmap(userId, roadmapId);
}
