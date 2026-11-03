import { AiError } from './ai-error';
import { AiCompletionRequest, AiProvider } from './ai-provider.interface';
import { GeneratedRoadmap } from '../../roadmaps/roadmap.validation';
import { buildMockRoadmap } from './mock-roadmap';

export { buildMockRoadmap } from './mock-roadmap';

export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const;

  async complete(request: AiCompletionRequest): Promise<string> {
    const context = request.context ?? {};
    switch (request.purpose) {
      case 'analyze':
        return JSON.stringify(buildAnalysis(context));
      case 'clarify':
        return JSON.stringify(buildClarification(context));
      case 'roadmap':
      case 'replan':
        return JSON.stringify(buildRoadmap(context));
      case 'chat':
        return buildChatReply(context);
      case 'explain':
        return `This task is "${String(context.title ?? 'your task')}". Follow the instructions one at a time and stop when every completion criterion is true.`;
      case 'evaluate': {
        const submission = String(context.submission ?? '');
        const passed = submission.trim().length >= 20;
        return JSON.stringify({
          passed,
          feedback: passed
            ? 'This covers the task. Keep the same pace tomorrow.'
            : 'Add a little more detail so the work shows what you practiced.',
          suggestions: passed
            ? ['Note one thing you want to repeat tomorrow.']
            : ['Describe what you did in two or three sentences.'],
        });
      }
      default:
        throw new AiError('INVALID_RESPONSE', 'Mock AI received an unknown purpose');
    }
  }
}

function buildChatReply(context: Record<string, unknown>) {
  const message = String(context.message ?? '').trim();
  const lower = message.toLowerCase();

  if (!message) {
    return 'Tell me one thing you want to work on today, and I will help you take the next small step.';
  }

  if (/what is react|what's react|whats react|react js|react\.js/i.test(lower)) {
    return [
      'React is a JavaScript library for building user interfaces, especially web apps.',
      'You write UI as components. When data (state) changes, React updates only the parts of the screen that need to change.',
      'A good first step today: create a tiny component that shows Hello and a button that changes some text when clicked.',
      'Want me to walk you through that button example step by step?',
    ].join('\n\n');
  }

  if (/what is java|what's java|learn java|java programming/i.test(lower)) {
    return [
      'Java is a general-purpose programming language used for apps, backends, and Android.',
      'Start with variables, if/else, loops, and methods. Then move to classes and objects.',
      'For today, open an online Java compiler and print Hello World. That one tiny win builds momentum.',
      'Want the exact Hello World code next?',
    ].join('\n\n');
  }

  if (/^(hi|hello|hey|yo)\b/i.test(lower)) {
    return 'Hi. What is one single task you want to focus on today? Name it, and if it feels too big, we can break it down.';
  }

  if (/help|stuck|motivat|overwhelm|procrastinat/i.test(lower)) {
    return [
      `I hear you. Let's keep this simple around: "${message}"`,
      'Pick one action you can finish in the next 10 minutes. Start a timer, do only that, then mark it done.',
      'Tell me the 10-minute action and I will tighten it further.',
    ].join('\n\n');
  }

  return [
    `Thanks for sharing: "${message}"`,
    'Here is a practical next step: write the smallest version of that work you can finish in 15 minutes or less, then do only that.',
    'Reply with that tiny version and I will help you sharpen it.',
  ].join('\n\n');
}

function buildAnalysis(context: Record<string, unknown>) {
  const title = String(context.title ?? 'your goal');
  const description = String(context.description ?? '').trim();
  const missing = description ? [] : ['A short description of your current experience'];
  return {
    category: String(context.category ?? 'personal'),
    currentLevel: String(context.currentLevel ?? 'beginner'),
    desiredOutcome: String(context.desiredOutcome || `Make steady progress on ${title}`),
    availableTimeMinutes: Number(context.availableMinutesPerDay ?? 60),
    missingInformation: missing,
    clarificationQuestions: missing.map((item, index) => ({
      id: `q${index + 1}`,
      question: item,
    })),
    summary: `You want to make progress on ${title} with the time you have available.`,
  };
}

function buildClarification(context: Record<string, unknown>) {
  const answers = Array.isArray(context.answers) ? context.answers : [];
  return {
    category: String(context.category ?? 'personal'),
    currentLevel: String(context.currentLevel || 'beginner'),
    desiredOutcome: String(context.desiredOutcome || 'A clear outcome based on your answers'),
    availableTimeMinutes: Number(context.availableMinutesPerDay ?? 60),
    missingInformation: [],
    clarificationQuestions: answers,
    summary: 'Thanks for the extra detail. The goal is ready for a roadmap.',
  };
}

function buildRoadmap(context: Record<string, unknown>): GeneratedRoadmap {
  return buildMockRoadmap({
    title: String(context.title ?? 'Goal'),
    category: String(context.category ?? 'personal'),
    durationDays: Number(context.durationDays ?? 7),
    dailyMinutes: Number(context.dailyMinutes ?? context.availableMinutesPerDay ?? 60),
    currentLevel: String(context.currentLevel ?? ''),
    desiredOutcome: String(context.desiredOutcome ?? ''),
    description: String(context.description ?? ''),
    summary: String(context.summary ?? ''),
  });
}

export const mockAiProvider = new MockAiProvider();
