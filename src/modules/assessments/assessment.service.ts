import { z } from 'zod';
import { logger } from '../../utils/logger';
import { AiError } from '../ai/providers/ai-error';
import { AssessmentModel, IAssessment } from './assessment.model';

export const analysisSchema = z.object({
  category: z.string().trim().min(1).max(50),
  currentLevel: z.string().trim().max(200).default(''),
  desiredOutcome: z.string().trim().max(2000).default(''),
  availableTimeMinutes: z.coerce.number().int().min(15).max(480),
  missingInformation: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  clarificationQuestions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        question: z.string().trim().min(1).max(300),
        answer: z.string().trim().max(2000).optional(),
      }),
    )
    .max(8)
    .default([]),
  summary: z.string().trim().max(2000).default(''),
});

export type GoalAnalysis = z.infer<typeof analysisSchema>;

const CATEGORIES = new Set(['education', 'fitness', 'career', 'health', 'finance', 'personal', 'other']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean)
    .slice(0, 8);
}

function coerceMinutes(value: unknown, fallback = 60): number {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(480, Math.max(15, Math.round(number)));
}

function normalizeQuestion(value: unknown, index: number) {
  if (typeof value === 'string') {
    return { id: `q${index + 1}`, question: value.trim() };
  }
  const record = asRecord(value);
  if (!record) return null;
  const question = String(record.question ?? record.text ?? record.prompt ?? '').trim();
  if (!question) return null;
  const id = String(record.id ?? record.questionId ?? `q${index + 1}`).trim() || `q${index + 1}`;
  const answerRaw = record.answer;
  const answer = answerRaw === undefined || answerRaw === null ? undefined : String(answerRaw);
  return { id, question, ...(answer !== undefined ? { answer } : {}) };
}

/** Soften common Gemini field-name / shape drift before Zod validation. */
export function normalizeAnalysisPayload(payload: unknown): unknown {
  const root = asRecord(payload);
  if (!root) return payload;

  const nested =
    asRecord(root.analysis) ??
    asRecord(root.result) ??
    asRecord(root.data) ??
    asRecord(root.goalAnalysis) ??
    root;

  const questionsRaw =
    nested.clarificationQuestions ??
    nested.clarification_questions ??
    nested.questions ??
    [];

  const questions = Array.isArray(questionsRaw)
    ? questionsRaw.map(normalizeQuestion).filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    category: String(nested.category ?? 'personal').trim() || 'personal',
    currentLevel: String(nested.currentLevel ?? nested.current_level ?? '').trim(),
    desiredOutcome: String(nested.desiredOutcome ?? nested.desired_outcome ?? nested.outcome ?? '').trim(),
    availableTimeMinutes: coerceMinutes(
      nested.availableTimeMinutes ??
        nested.availableMinutesPerDay ??
        nested.available_time_minutes ??
        nested.dailyMinutes ??
        nested.availableTime,
      60,
    ),
    missingInformation: asStringArray(nested.missingInformation ?? nested.missing_information ?? nested.missing),
    clarificationQuestions: questions,
    summary: String(nested.summary ?? nested.overview ?? '').trim(),
  };
}

export function parseAnalysis(payload: unknown): GoalAnalysis {
  const normalized = normalizeAnalysisPayload(payload);
  const parsed = analysisSchema.safeParse(normalized);
  if (!parsed.success) {
    logger.warn(
      { issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
      'AI analysis schema mismatch',
    );
    throw new AiError('INVALID_RESPONSE', 'AI analysis did not match the expected format');
  }
  const category = CATEGORIES.has(parsed.data.category) ? parsed.data.category : 'other';
  return { ...parsed.data, category };
}

export async function saveAssessment(userId: string, goalId: string, analysis: GoalAnalysis) {
  const status =
    analysis.missingInformation.length > 0 ||
    analysis.clarificationQuestions.some((item) => !item.answer?.trim())
      ? 'needs_clarification'
      : 'ready';

  const assessment = await AssessmentModel.findOneAndUpdate(
    { userId, goalId },
    {
      $set: {
        userId,
        goalId,
        category: analysis.category,
        currentLevel: analysis.currentLevel,
        desiredOutcome: analysis.desiredOutcome,
        availableTimeMinutes: analysis.availableTimeMinutes,
        missingInformation: analysis.missingInformation,
        clarificationQuestions: analysis.clarificationQuestions,
        summary: analysis.summary,
        status,
      },
    },
    { upsert: true, new: true },
  );

  return toAssessmentDto(assessment);
}

export async function getAssessment(userId: string, goalId: string) {
  return AssessmentModel.findOne({ userId, goalId });
}

export function toAssessmentDto(assessment: IAssessment) {
  return {
    id: assessment._id.toString(),
    goalId: assessment.goalId.toString(),
    category: assessment.category,
    currentLevel: assessment.currentLevel,
    desiredOutcome: assessment.desiredOutcome,
    availableTimeMinutes: assessment.availableTimeMinutes,
    missingInformation: assessment.missingInformation,
    clarificationQuestions: assessment.clarificationQuestions,
    summary: assessment.summary,
    status: assessment.status,
  };
}
