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
      case 'explain': {
        const title = String(context.title ?? 'your task');
        if (context.replyLanguage === 'hi') {
          return [
            `Yeh task "${title}" aaj ke plan ka clear next step hai.`,
            '- Pehle title padho aur 1 minute me decide karo “done” kya dikhega.',
            '- Instructions ko ek-ek karke follow karo — skip mat karo.',
            '- Har completion criterion true hone par hi complete mark karo.',
            '- Common mistake: bina proof ke skip kar dena — chhota evidence rakho.',
            '- Pehle 5 minute: sirf pehli instruction start karo.',
            'Chhote steps se streak banti hai — ab pehla step lo.',
          ].join('\n');
        }
        return [
          `This task, "${title}", is your next clear step in today’s plan.`,
          '- Read the title and define what “done” looks like in one sentence.',
          '- Follow the instructions in order — finish one before the next.',
          '- Only mark complete when every completion criterion is true.',
          '- Avoid the common trap: rushing without a small proof of work.',
          '- First 5 minutes: start only the first instruction.',
          'Small steps build the streak — take the first one now.',
        ].join('\n');
      }
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

function looksHindi(text: string, replyLanguage?: unknown) {
  if (replyLanguage === 'hi') return true;
  if (replyLanguage === 'en') return false;
  return (
    /[\u0900-\u097F]/.test(text) ||
    /\b(hai|hain|kya|kaise|mujhe|mera|meri|seekh|padh|chod|karna|karo|batao|samjhao|chahiye|aaj|madad|namaste)\b/i.test(
      text,
    )
  );
}

function buildChatReply(context: Record<string, unknown>) {
  const message = String(context.message ?? '').trim();
  const lower = message.toLowerCase();
  const hindi = looksHindi(message, context.replyLanguage);

  if (!message) {
    return hindi
      ? 'Aaj kis ek cheez pe kaam karna hai? Batao, main uska chhota next step nikaal dunga.'
      : 'Tell me one thing you want to work on today, and I will help you take the next small step.';
  }

  if (/react|रिएक्ट/i.test(lower)) {
    return hindi
      ? [
          'React ek JavaScript library hai jo UI banane ke liye use hoti hai.',
          'Aap screen ko components me todte ho. Jab data (state) badalta hai, React sirf zaruri hissa update karta hai.',
          'Aaj ka chhota step: ek component banao jo Hello dikhaye aur button dabane pe text badle.',
        ].join('\n\n')
      : [
          'React is a JavaScript library for building user interfaces, especially web apps.',
          'You write UI as components. When data (state) changes, React updates only the parts of the screen that need to change.',
          'A good first step today: create a tiny component that shows Hello and a button that changes some text when clicked.',
        ].join('\n\n');
  }

  if (/java|जावा/i.test(lower) && !/javascript/i.test(lower)) {
    return hindi
      ? [
          'Java ek programming language hai — apps, backend, aur Android ke liye common hai.',
          'Pehle variables, if/else, loops, methods. Phir classes aur objects.',
          'Aaj ka task: online Java compiler kholo aur Hello World print karo. Chhota win momentum laata hai.',
        ].join('\n\n')
      : [
          'Java is a general-purpose programming language used for apps, backends, and Android.',
          'Start with variables, if/else, loops, and methods. Then move to classes and objects.',
          'For today, open an online Java compiler and print Hello World. That one tiny win builds momentum.',
        ].join('\n\n');
  }

  if (/^(hi|hello|hey|yo|namaste|नमस्ते)\b/i.test(lower)) {
    return hindi
      ? 'Namaste. Aaj ka ek single task batao — jo bada lage use chhote steps me tod denge.'
      : 'Hi. What is one single task you want to focus on today? Name it, and if it feels too big, we can break it down.';
  }

  if (/help|stuck|motivat|overwhelm|procrastinat|madad|phas|himmat|thak/i.test(lower)) {
    return hindi
      ? [
          `Samajh gaya: "${message}"`,
          'Agle 10 minute ka ek action choose karo. Timer lagaao, sirf wahi karo, phir done mark karo.',
          'Woh 10-minute action yahan likh do — main use aur clear kar dunga.',
        ].join('\n\n')
      : [
          `I hear you. Let's keep this simple around: "${message}"`,
          'Pick one action you can finish in the next 10 minutes. Start a timer, do only that, then mark it done.',
          'Tell me the 10-minute action and I will tighten it further.',
        ].join('\n\n');
  }

  return hindi
    ? [
        `Thanks: "${message}"`,
        'Achievo pe yahi idea hai — alag alag jagah bhatakne ki jagah yahan se clear next task lo.',
        'Abhi ka practical step: is kaam ka sabse chhota version likho jo 15 minute me ho sake, aur sirf wahi start karo.',
      ].join('\n\n')
    : [
        `Thanks for sharing: "${message}"`,
        'Achievo is meant to keep your next actions in one place instead of hopping across apps.',
        'Practical next step: write the smallest version of that work you can finish in 15 minutes or less, then do only that.',
      ].join('\n\n');
}

function buildAnalysis(context: Record<string, unknown>) {
  const title = String(context.title ?? 'your goal');
  const description = String(context.description ?? '').trim();
  const blob = `${title} ${description} ${String(context.desiredOutcome ?? '')}`.toLowerCase();
  const isQuit =
    /\b(quit|stop|give\s*up|break|avoid|no\s*more|chodna|chod)\b/.test(blob) &&
    /\b(smok\w*|cigar\w*|vape\w*|gambl\w*|alcohol|drink\w*|porn|sugar|social\s*media)\b/.test(blob);
  const isCoding = /\b(cod(e|ing)?|program|java|javascript|python|react|dsa)\b/.test(blob);
  const category = isQuit
    ? 'health'
    : isCoding
      ? 'education'
      : String(context.category ?? 'personal');
  const desiredOutcome = String(
    context.desiredOutcome ||
      (isQuit
        ? `Stay free from the habit for the planned days`
        : isCoding
          ? `Practice ${title} daily and ship small working examples`
          : `Make steady progress on ${title}`),
  );
  const missing = description
    ? []
    : [
        isQuit
          ? 'When do urges usually hit, and what has helped even a little?'
          : 'A short description of your current experience',
      ];
  return {
    category,
    currentLevel: String(context.currentLevel ?? 'beginner'),
    desiredOutcome,
    availableTimeMinutes: Number(context.availableMinutesPerDay ?? 60),
    missingInformation: missing,
    clarificationQuestions: missing.map((item, index) => ({
      id: `q${index + 1}`,
      question: item,
    })),
    summary: description
      ? `Goal: ${title}. ${description.slice(0, 400)}`
      : `You want to work on ${title} with the time you have available.`,
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
