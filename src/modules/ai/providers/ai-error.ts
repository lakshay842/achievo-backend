export type AiErrorCode =
  | 'RATE_LIMIT'
  | 'QUOTA'
  | 'INVALID_RESPONSE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'CONFIG'
  | 'UPSTREAM';

const statusByCode: Record<AiErrorCode, number> = {
  RATE_LIMIT: 429,
  QUOTA: 429,
  INVALID_RESPONSE: 502,
  TIMEOUT: 504,
  NETWORK: 503,
  CONFIG: 500,
  UPSTREAM: 502,
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly statusCode: number;

  constructor(code: AiErrorCode, message: string, statusCode = statusByCode[code]) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isRetryableAiError(error: unknown): boolean {
  if (!(error instanceof AiError)) return false;
  return error.code === 'RATE_LIMIT' || error.code === 'TIMEOUT' || error.code === 'NETWORK' || error.code === 'UPSTREAM';
}

export function classifyGeminiError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  const status = readStatus(err);
  const message = readMessage(err);
  const name = err instanceof Error ? err.name : '';

  if (name === 'AbortError' || name === 'TimeoutError' || /timeout|aborted/i.test(message)) {
    return new AiError('TIMEOUT', 'The AI request timed out');
  }

  if (
    status === 503 ||
    status === 429 ||
    /high demand|overloaded|unavailable|try again later|resource_exhausted|UNAVAILABLE|capacity|quota|exceeded/i.test(
      message,
    )
  ) {
    if (/quota|billing|exceeded your current quota/i.test(message)) {
      return new AiError('QUOTA', 'AI quota exceeded');
    }
    return new AiError('RATE_LIMIT', 'AI provider is busy. Retrying with a fallback.');
  }

  if (status === 401 || status === 403 || /ACCESS_TOKEN_TYPE_UNSUPPORTED|UNAUTHENTICATED|PERMISSION_DENIED/i.test(message)) {
    return new AiError('CONFIG', 'AI provider rejected the credentials');
  }

  if (status === 404 || /no longer available|model.*not found|NOT_FOUND/i.test(message)) {
    return new AiError(
      'CONFIG',
      'Configured Gemini model is unavailable. Set GEMINI_MODEL to a current model such as gemini-3.6-flash.',
      502,
    );
  }

  if (/fetch failed|network|econn|enotfound|socket|getaddrinfo/i.test(message)) {
    return new AiError('NETWORK', 'AI provider network error');
  }

  const short = message.replace(/\s+/g, ' ').trim().slice(0, 240);
  return new AiError('UPSTREAM', short || 'AI provider request failed');
}

function readStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || !err) return undefined;
  const candidate = err as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.statusCode === 'number') return candidate.statusCode;

  const nested = extractJsonPayload(err);
  if (nested && typeof nested.code === 'number') return nested.code;
  return undefined;
}

function readMessage(err: unknown): string {
  if (!(err instanceof Error) || !err.message) {
    return 'Gemini request failed';
  }

  const nested = extractJsonPayload(err);
  if (nested && typeof nested.message === 'string' && nested.message.trim()) {
    return nested.message;
  }

  return err.message;
}

function extractJsonPayload(err: unknown): { code?: number; message?: string; status?: string } | null {
  if (!(err instanceof Error)) return null;

  try {
    const parsed = JSON.parse(err.message) as {
      error?: { code?: number; message?: string; status?: string };
      code?: number;
      message?: string;
      status?: string;
    };
    if (parsed.error && typeof parsed.error === 'object') {
      return parsed.error;
    }
    return parsed;
  } catch {
    return null;
  }
}
