import { motivationForUser } from '../ai/services/motivation.service';
import { chatWithCoach, getCoachHistory } from '../ai/services/coach-chat.service';

export async function dailyMotivation(userId: string) {
  return motivationForUser(userId);
}

export async function coachChat(
  userId: string,
  input: { message: string; conversationId?: string; goalId?: string },
) {
  return chatWithCoach(userId, input);
}

export async function coachHistory(userId: string, conversationId?: string) {
  return getCoachHistory(userId, conversationId);
}
