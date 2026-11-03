import { AiError } from './providers/ai-error';

export function parseAiJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as unknown;
      } catch {
        // fall through
      }
    }
    throw new AiError('INVALID_RESPONSE', 'AI returned invalid JSON');
  }
}
