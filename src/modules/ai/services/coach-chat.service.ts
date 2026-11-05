import { z } from 'zod';
import { getAiProvider } from '../../../config/ai';
import { toPlainText } from '../../../utils/plain-text';
import { randomToken } from '../../../utils/tokens';
import { AIConversationModel } from '../conversation.model';
import { GoalModel } from '../../goals/goal.model';
import { requireOwnedGoal } from '../../goals/goal.service';
import { requireOwnedTask } from '../../tasks/task.service';
import { TaskModel } from '../../tasks/task.model';
import { AiError } from '../providers/ai-error';
import { parseAiJson } from '../ai.json';

const coachSystem = `You are ACHIEVO AI, the user's personal coach inside one app.
Your job: keep learning + habit change in ONE place — clear next actions, practice, and progress — so they do not need to jump across random websites, notes, and apps to figure out what to do today.

How to answer:
- Be accurate, practical, and specific. Prefer a concrete next step they can do in the next 10–30 minutes.
- If they ask a factual or how-to question (coding, study topic, quitting a habit, etc.), give a correct useful answer first, then one Achievo-style next action.
- Language (strict): follow replyLanguage in the request. en = clear English only. hi = natural Hindi/Hinglish. Match the LATEST user message, not older chat history. Default to English when unsure.
- Keep replies clear: usually 2–6 short sentences. Use plain numbered steps 1. 2. 3. when helpful.
- Never shame the user. Never invent that you checked the internet. Never claim medical/legal authority; for addiction/health, stay supportive and practical.
- Use their active goals/tasks from context when relevant. If context is empty, still help with a clear plan.
- You are not a search engine dump — stay coach-like: answer + next step.

Write in plain text only. No markdown, headings, bold, bullets, dividers, or code fences.`;

const explainSystem = `You are ACHIEVO AI helping the user understand one task.

Reply shape (always):
1) One short plain-text intro (1–2 sentences): what this task is and why it helps.
2) Then a useful bullet list of 4–6 concrete points. Prefer lines starting with "- ".
   Cover: what to do step-by-step, what “done” looks like, a common mistake to avoid, and the first 5-minute start.
3) Optional one-line closer with encouragement.

Language (strict): follow replyLanguage. If replyLanguage is en, write entirely in clear English — no Hindi/Hinglish. Only use Hindi/Hinglish when replyLanguage is hi.
No markdown headings, bold, tables, or code fences. Bullets with "- " are required and encouraged.
Never shame the user. Be specific to THIS task title and instructions — do not give generic filler.`;

function detectReplyLanguage(text: string): 'en' | 'hi' {
  const value = text.trim();
  if (!value) return 'en';

  const hindiChars = (value.match(/[\u0900-\u097F]/g) ?? []).length;
  const latinChars = (value.match(/[A-Za-z]/g) ?? []).length;

  // Devanagari-heavy → Hindi
  if (hindiChars >= 6 && hindiChars >= latinChars * 0.35) {
    return 'hi';
  }

  // Mostly Latin letters → English (English task copy, English chat)
  if (latinChars >= 8 && latinChars > hindiChars * 2) {
    return 'en';
  }

  const hinglishHits =
    value.match(
      /\b(hai|hain|kya|kaise|mujhe|mera|meri|seekhna|seekh|padhna|padh|chodna|karna|batao|samjhao|nahi|kripya)\b/gi,
    ) ?? [];
  if (hinglishHits.length >= 2 && latinChars < 50) {
    return 'hi';
  }

  return 'en';
}

const evaluationSchema = z.object({
  passed: z.boolean(),
  feedback: z.string().trim().min(1).max(2000),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(6),
});

async function coachContext(userId: string, goalId?: string) {
  const goalFilter = goalId
    ? { _id: goalId, userId }
    : { userId, status: { $in: ['active', 'draft'] } };

  const goals = await GoalModel.find(goalFilter).sort({ updatedAt: -1 }).limit(5);
  const activeGoalIds = goals.map((goal) => goal._id);
  const tasks = activeGoalIds.length
    ? await TaskModel.find({
        userId,
        goalId: { $in: activeGoalIds },
        status: { $in: ['pending', 'in_progress'] },
      })
        .sort({ scheduledDate: 1, day: 1 })
        .limit(8)
    : [];

  return {
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      category: goal.category,
      currentLevel: goal.currentLevel,
      desiredOutcome: goal.desiredOutcome,
      status: goal.status,
    })),
    upcomingTasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      day: task.day,
      status: task.status,
    })),
  };
}

export async function chatWithCoach(
  userId: string,
  input: { message: string; conversationId?: string; goalId?: string },
) {
  if (input.goalId) await requireOwnedGoal(userId, input.goalId);
  const conversationId = input.conversationId ?? randomToken(12);

  const conversation = await AIConversationModel.findOneAndUpdate(
    { userId, conversationId },
    {
      $setOnInsert: {
        userId,
        conversationId,
        goalId: input.goalId ?? null,
        purpose: 'chat',
      },
      $push: {
        messages: {
          role: 'user',
          content: input.message,
          createdAt: new Date(),
        },
      },
    },
    { upsert: true, new: true },
  );

  const history = (conversation?.messages ?? []).slice(-11, -1);
  const context = await coachContext(userId, input.goalId);
  const replyLanguage = detectReplyLanguage(input.message);

  const provider = getAiProvider();
  const reply = toPlainText(
    await provider.complete({
      purpose: 'chat',
      system: coachSystem,
      user: JSON.stringify({
        instruction:
          replyLanguage === 'en'
            ? 'Answer in clear English only. Tie advice to their goals/tasks when useful.'
            : 'Answer in natural Hindi/Hinglish. Tie advice to their goals/tasks when useful.',
        replyLanguage,
        history: history.map((item) => ({ role: item.role, content: item.content })),
        message: input.message,
        userContext: context,
      }),
      json: false,
      temperature: 0.45,
      context: { message: input.message, replyLanguage },
    }),
  );

  await AIConversationModel.updateOne(
    { userId, conversationId },
    {
      $push: {
        messages: {
          role: 'assistant',
          content: reply,
          createdAt: new Date(),
        },
      },
    },
  );

  return { conversationId, reply };
}

export async function getCoachHistory(userId: string, conversationId?: string) {
  const conversation = conversationId
    ? await AIConversationModel.findOne({ userId, conversationId, purpose: 'chat' })
    : await AIConversationModel.findOne({ userId, purpose: 'chat' }).sort({ updatedAt: -1 });

  if (!conversation) {
    return { conversationId: null as string | null, messages: [] as Array<{ role: 'user' | 'assistant'; content: string; createdAt: Date }> };
  }

  return {
    conversationId: conversation.conversationId,
    messages: conversation.messages.map((item) => ({
      role: item.role,
      content: item.role === 'assistant' ? toPlainText(item.content) : item.content,
      createdAt: item.createdAt,
    })),
  };
}

export async function explainTask(userId: string, taskId: string) {
  const task = await requireOwnedTask(userId, taskId);
  const taskText = [
    task.title,
    ...(task.instructions ?? []),
    ...(task.completionCriteria ?? []),
  ].join('\n');
  const replyLanguage = detectReplyLanguage(taskText);
  const provider = getAiProvider();
  const explanation = toPlainText(
    await provider.complete({
      purpose: 'explain',
      system: explainSystem,
      user: JSON.stringify({
        instruction:
          replyLanguage === 'en'
            ? 'Explain this task in clear English only.'
            : 'Explain this task in natural Hindi/Hinglish.',
        replyLanguage,
        title: task.title,
        instructions: task.instructions,
        completionCriteria: task.completionCriteria,
        durationMinutes: task.durationMinutes,
      }),
      json: false,
      context: { title: task.title, replyLanguage },
    }),
  );
  return { taskId: task.id, explanation };
}

export async function evaluateTask(userId: string, taskId: string, submission: string) {
  const task = await requireOwnedTask(userId, taskId);
  const provider = getAiProvider();
  const text = await provider.complete({
    purpose: 'evaluate',
    system: `${coachSystem} Return only JSON with passed, feedback, and suggestions.`,
    user: JSON.stringify({
      title: task.title,
      completionCriteria: task.completionCriteria,
      submission,
    }),
    json: true,
    context: { submission, title: task.title },
  });
  const parsed = evaluationSchema.safeParse(parseAiJson(text));
  if (!parsed.success) {
    throw new AiError('INVALID_RESPONSE', 'AI evaluation did not match the expected format');
  }
  return { taskId: task.id, ...parsed.data };
}
