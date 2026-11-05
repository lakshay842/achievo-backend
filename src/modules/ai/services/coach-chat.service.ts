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
- Language (STRICT — never ignore replyLanguage):
  - replyLanguage=en → write entirely in clear English.
  - replyLanguage=hi → write the FULL reply in natural Hindi/Hinglish (Roman script OK). Never say you are in "English mode". Never answer in English when replyLanguage is hi, even if earlier chat was English.
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

Language (STRICT): follow replyLanguage. en = English only. hi = Hindi/Hinglish only (Roman OK).
No markdown headings, bold, tables, or code fences. Bullets with "- " are required and encouraged.
Never shame the user. Be specific to THIS task title and instructions — do not give generic filler.`;

const HINGLISH_WORD =
  /\b(hai|hain|hoon|hun|kya|kaise|kyun|kyu|mujhe|mujhko|mera|meri|mere|hum|aap|tum|seekhna|seekhni|seekho|seekh|padhna|padho|padh|chodna|chodo|karna|karo|karke|batao|btao|bataana|bata|samjhao|samjha|samajh|nahi|nahin|mat|kripya|madad|chahiye|chahie|aaj|kal|abhi|thoda|zyada|accha|acha|theek|namaste|bhai|yaar|kaam|shuru|shuruat|dikhao|dena|dijiye|bolo|bolna|samjhao)\b/i;

function wantsEnglish(text: string): boolean {
  return /\b(in\s+english|english\s+(me|mein|mai|language)|reply\s+in\s+english|answer\s+in\s+english)\b/i.test(
    text,
  );
}

function wantsHindi(text: string): boolean {
  if (/[\u0900-\u097F]{2,}/.test(text)) return true;
  if (
    /\b(in\s+hindi|hindi\s+(me|mein|mai|language)|hinglish|hindi\s+me\s+b(a)?tao|hindi\s+me\s+samjhao|reply\s+in\s+hindi|answer\s+in\s+hindi)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\bhindi\b/i.test(text) && /\b(me|mein|mai|btao|batao|samjhao|bolo|explain|bata)\b/i.test(text)) {
    return true;
  }
  return HINGLISH_WORD.test(text);
}

function detectReplyLanguage(
  text: string,
  history: Array<{ role: string; content: string }> = [],
): 'en' | 'hi' {
  const value = text.trim();
  if (!value) return 'en';

  if (wantsEnglish(value)) return 'en';
  if (wantsHindi(value)) return 'hi';

  // Keep Hindi for the rest of the chat after the user asked for it.
  const recentUser = history.filter((item) => item.role === 'user').slice(-6);
  if (recentUser.some((item) => wantsHindi(item.content)) && !wantsEnglish(value)) {
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
  const historyForLang = history.map((item) => ({ role: item.role, content: item.content }));
  const replyLanguage = detectReplyLanguage(input.message, historyForLang);

  const provider = getAiProvider();
  const reply = toPlainText(
    await provider.complete({
      purpose: 'chat',
      system: coachSystem,
      user: JSON.stringify({
        instruction:
          replyLanguage === 'en'
            ? 'Answer in clear English only. Tie advice to their goals/tasks when useful.'
            : 'CRITICAL: replyLanguage=hi. User asked for Hindi. Reply FULLY in Hindi/Hinglish (Roman OK). Do not say English mode. Do not use English paragraphs.',
        replyLanguage,
        history: historyForLang,
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
