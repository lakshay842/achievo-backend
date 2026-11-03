import { z } from 'zod';
import { getAiProvider } from '../../../config/ai';
import { toPlainText } from '../../../utils/plain-text';
import { randomToken } from '../../../utils/tokens';
import { AIConversationModel } from '../conversation.model';
import { requireOwnedGoal } from '../../goals/goal.service';
import { requireOwnedTask } from '../../tasks/task.service';
import { AiError } from '../providers/ai-error';
import { parseAiJson } from '../ai.json';

const coachSystem = `You are ACHIEVO, a calm and practical coach.
Be brief, specific, and kind. Never shame, threaten, or manipulate the user.
Help them take the next useful step.

Write in plain text only. Do not use markdown.
Never use # headings, * or ** bold/italics, bullet markers like * or -, --- dividers, or fenced code blocks.
Use short paragraphs. For lists, use plain numbers like 1. 2. 3.`;

const evaluationSchema = z.object({
  passed: z.boolean(),
  feedback: z.string().trim().min(1).max(2000),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(6),
});

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

  const history = (conversation?.messages ?? []).slice(-21, -1);

  const provider = getAiProvider();
  const reply = toPlainText(
    await provider.complete({
      purpose: 'chat',
      system: coachSystem,
      user: JSON.stringify({
        history: history.map((item) => ({ role: item.role, content: item.content })),
        message: input.message,
      }),
      json: false,
      temperature: 0.5,
      context: { message: input.message },
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
  const provider = getAiProvider();
  const explanation = toPlainText(
    await provider.complete({
      purpose: 'explain',
      system: coachSystem,
      user: JSON.stringify({
        title: task.title,
        instructions: task.instructions,
        completionCriteria: task.completionCriteria,
        durationMinutes: task.durationMinutes,
      }),
      json: false,
      context: { title: task.title },
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
