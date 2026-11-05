import { getAiProvider } from '../../../config/ai';
import { ApiError } from '../../../utils/ApiError';
import { getAssessment, parseAnalysis, saveAssessment } from '../../assessments/assessment.service';
import { GoalModel } from '../../goals/goal.model';
import { requireOwnedGoal, toGoalDto } from '../../goals/goal.service';
import { parseAiJson } from '../ai.json';
import { AiError } from '../providers/ai-error';

const system = `You are ACHIEVO, a planning coach. Return only JSON matching this schema exactly.
Never shame the user. Ask only for information that changes the plan.

Use a category from: education, fitness, career, health, finance, personal, other.

Goal types you must handle well (detect from title + description):
- skill_learning: coding, language, exam, course, instrument, craft
- habit_quit: stop smoking/cigarettes, gambling, alcohol, junk food, social media, etc.
- habit_build: start gym, meditation, reading, sleep routine, saving money
- fitness: run, strength, yoga, weight loss
- career: job search, interview, promotion, portfolio
- finance: budget, debt, investing
- other personal goals

Schema:
{"category":"personal","currentLevel":"beginner","desiredOutcome":"string","availableTimeMinutes":60,"missingInformation":["string"],"clarificationQuestions":[{"id":"q1","question":"string"}],"summary":"string"}

Rules:
- availableTimeMinutes must be an integer between 15 and 480.
- clarificationQuestions[].id is required (q1, q2, ...).
- If nothing is missing, return empty arrays for missingInformation and clarificationQuestions.
- summary must restate the user's REAL goal in plain language (what they want to learn OR stop OR build), including key details from their description. Max 500 chars.
- desiredOutcome must be concrete and specific to THEIR goal (e.g. "Stay smoke-free for 30 days" or "Build 3 React projects"), never a vague "make progress".
- For habit_quit goals: category is usually health or personal; currentLevel can describe how often the habit happens if known.
- Ask at most 3 clarification questions, and only if answers would change daily tasks.
- Never treat habit_quit as a "learn about X" study plan.`;

export interface AnalyzeInput {
  goalId?: string;
  title: string;
  description?: string;
  category?: string;
  currentLevel?: string;
  desiredOutcome?: string;
  availableMinutesPerDay: number;
  durationDays: number;
}

export async function analyzeGoal(userId: string, input: AnalyzeInput) {
  const goal = input.goalId
    ? await requireOwnedGoal(userId, input.goalId)
    : await GoalModel.create({
        userId,
        title: input.title,
        description: input.description ?? '',
        category: input.category ?? 'personal',
        currentLevel: input.currentLevel ?? '',
        desiredOutcome: input.desiredOutcome ?? '',
        availableMinutesPerDay: input.availableMinutesPerDay,
        durationDays: input.durationDays,
        status: 'draft',
      });

  if (input.goalId) {
    goal.title = input.title;
    if (input.description !== undefined) goal.description = input.description;
    if (input.category) goal.category = input.category;
    if (input.currentLevel !== undefined) goal.currentLevel = input.currentLevel;
    if (input.desiredOutcome !== undefined) goal.desiredOutcome = input.desiredOutcome;
    goal.availableMinutesPerDay = input.availableMinutesPerDay;
    goal.durationDays = input.durationDays;
    await goal.save();
  }

  const provider = getAiProvider();
  const analyzePayload = {
    title: goal.title,
    description: goal.description,
    category: goal.category,
    currentLevel: goal.currentLevel,
    desiredOutcome: goal.desiredOutcome,
    availableMinutesPerDay: goal.availableMinutesPerDay,
    durationDays: goal.durationDays,
  };
  const analysis = await requestValidAnalysis(async (repairErrors) =>
    provider.complete({
      purpose: 'analyze',
      system,
      user: JSON.stringify({
        instruction:
          'Read the user goal carefully. Infer the true intent (learn / quit / build / fitness / career / finance). Fill the schema for THIS goal only.',
        goal: analyzePayload,
        repairErrors,
      }),
      json: true,
      temperature: 0.2,
      context: analyzePayload,
    }),
  );
  goal.category = analysis.category || goal.category;
  goal.currentLevel = analysis.currentLevel || goal.currentLevel;
  goal.desiredOutcome = analysis.desiredOutcome || goal.desiredOutcome;
  analysis.availableTimeMinutes = goal.availableMinutesPerDay;
  await goal.save();
  const assessment = await saveAssessment(userId, goal.id, analysis);

  return { goal: toGoalDto(goal), assessment };
}

async function requestValidAnalysis(complete: (repairErrors?: string) => Promise<string>) {
  let lastError = 'Invalid analysis';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await complete(attempt === 0 ? undefined : lastError);
    try {
      return parseAnalysis(parseAiJson(text));
    } catch (error) {
      if (error instanceof AiError && error.code !== 'INVALID_RESPONSE') throw error;
      lastError = error instanceof Error ? error.message : 'Invalid analysis';
    }
  }
  throw new AiError('INVALID_RESPONSE', `AI analysis failed validation: ${lastError}`);
}

export async function clarifyGoal(
  userId: string,
  input: { goalId: string; answers: Array<{ questionId?: string; question?: string; answer: string }> },
) {
  const goal = await requireOwnedGoal(userId, input.goalId);
  const existing = await getAssessment(userId, goal.id);
  if (!existing) {
    throw new ApiError(409, 'Analyze the goal before submitting clarifications');
  }

  // Mongoose subdocs must be read as plain fields — `{ ...subdoc }` drops id/question/answer.
  const answers = existing.clarificationQuestions.map((question) => {
    const id = String(question.id ?? '').trim();
    const text = String(question.question ?? '').trim();
    const previous = typeof question.answer === 'string' ? question.answer : undefined;
    const match = input.answers.find(
      (item) => (item.questionId && item.questionId === id) || (item.question && item.question === text),
    );
    return {
      id,
      question: text,
      answer: match?.answer?.trim() || previous,
    };
  });

  const answered = answers.filter((item) => Boolean(item.answer?.trim()));
  const pending = answers.filter((item) => !item.answer?.trim());
  const answerSummary = answered.map((item) => `${item.question}: ${item.answer}`).join(' ');
  const allAnswered = pending.length === 0;

  // Keep clarify local. Gemini analyze already shaped the goal; waiting on another
  // model call here caused 504s when the provider exceeded AI_TIMEOUT_MS.
  const analysis = {
    category: existing.category || goal.category || 'personal',
    currentLevel: existing.currentLevel || goal.currentLevel || '',
    desiredOutcome: existing.desiredOutcome || goal.desiredOutcome || answered[0]?.answer || '',
    availableTimeMinutes: existing.availableTimeMinutes || goal.availableMinutesPerDay,
    missingInformation: allAnswered ? [] : pending.map((item) => item.question).slice(0, 8),
    clarificationQuestions: answers,
    summary: [
      (existing.summary || '').replace(/\s*Details:[\s\S]*$/i, '').trim(),
      answered.length ? `Details: ${answerSummary}` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 2000),
  };

  goal.category = analysis.category || goal.category;
  goal.currentLevel = analysis.currentLevel || goal.currentLevel;
  goal.desiredOutcome = analysis.desiredOutcome || goal.desiredOutcome;
  if (!goal.description && answered[0]?.answer) {
    goal.description = answered[0].answer;
  }
  await goal.save();
  const assessment = await saveAssessment(userId, goal.id, analysis);
  return { goal: toGoalDto(goal), assessment };
}
