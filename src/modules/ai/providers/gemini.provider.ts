import { GoogleGenAI } from '@google/genai';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';
import { AiError, classifyGeminiError, isRetryableAiError } from './ai-error';
import { AiCompletionRequest, AiProvider } from './ai-provider.interface';
import { mockAiProvider } from './mock.provider';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function modelCandidates(): string[] {
  return Array.from(new Set([env.geminiModel, ...env.geminiFallbackModels].filter(Boolean)));
}

/** Keep generation short where UX needs speed; roadmaps still need headroom. */
function maxOutputTokensFor(purpose: AiCompletionRequest['purpose']): number {
  switch (purpose) {
    case 'roadmap':
    case 'replan':
      return 16384;
    case 'analyze':
    case 'clarify':
    case 'evaluate':
      return 3072;
    case 'chat':
    case 'explain':
    default:
      return 2048;
  }
}

function timeoutMsFor(purpose: AiCompletionRequest['purpose']): number {
  if (purpose === 'roadmap' || purpose === 'replan') {
    return Math.max(env.aiTimeoutMs, 45_000);
  }
  if (purpose === 'analyze' || purpose === 'clarify') {
    return Math.max(env.aiTimeoutMs, 30_000);
  }
  return env.aiTimeoutMs;
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;

  async complete(request: AiCompletionRequest): Promise<string> {
    if (!env.geminiApiKey) {
      if (env.aiFallbackToMock) {
        logger.warn({ purpose: request.purpose }, 'GEMINI_API_KEY missing; using mock AI');
        return mockAiProvider.complete(request);
      }
      throw new AiError('CONFIG', 'GEMINI_API_KEY is not configured');
    }

    const models = modelCandidates();
    let lastError: AiError | null = null;

    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex]!;
      const attempts = env.aiMaxRetries + 1;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          return await this.completeOnce(request, model);
        } catch (error) {
          const classified = classifyGeminiError(error);
          lastError = classified;

          const hasMoreAttempts = attempt < attempts - 1;
          const hasMoreModels = modelIndex < models.length - 1;
          // Hard quota on one model — skip retries and try the next model.
          const canRetry =
            isRetryableAiError(classified) && classified.code !== 'QUOTA' && hasMoreAttempts;
          const canSwitchModel =
            hasMoreModels &&
            (isRetryableAiError(classified) ||
              classified.code === 'CONFIG' ||
              classified.code === 'QUOTA' ||
              classified.code === 'RATE_LIMIT');

          logger.warn(
            {
              provider: this.name,
              purpose: request.purpose,
              model,
              attempt: attempt + 1,
              attempts,
              code: classified.code,
              status: classified.statusCode,
              message: classified.message,
              next: canRetry ? 'retry' : canSwitchModel ? 'fallback-model' : env.aiFallbackToMock ? 'mock' : 'fail',
            },
            'AI request failed',
          );

          if (canRetry) {
            await sleep(500 * 2 ** attempt);
            continue;
          }

          if (canSwitchModel) {
            break;
          }

          return this.finishWithFallback(request, classified);
        }
      }
    }

    return this.finishWithFallback(
      request,
      lastError ?? new AiError('UPSTREAM', 'AI provider request failed'),
    );
  }

  private finishWithFallback(request: AiCompletionRequest, error: AiError): Promise<string> {
    if (env.aiFallbackToMock) {
      logger.warn(
        { provider: this.name, purpose: request.purpose, code: error.code, message: error.message },
        'Falling back to mock AI',
      );
      return mockAiProvider.complete(request);
    }
    throw error;
  }

  private async completeOnce(request: AiCompletionRequest, model: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const started = Date.now();

    try {
      const response = await ai.models.generateContent({
        model,
        contents: request.user,
        config: {
          systemInstruction: request.system,
          temperature: request.temperature ?? 0.4,
          maxOutputTokens: maxOutputTokensFor(request.purpose),
          responseMimeType: request.json ? 'application/json' : 'text/plain',
          abortSignal: AbortSignal.timeout(timeoutMsFor(request.purpose)),
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new AiError('INVALID_RESPONSE', 'AI returned an empty response');
      }

      logger.info(
        { provider: this.name, purpose: request.purpose, model, ms: Date.now() - started },
        'AI request completed',
      );
      return text;
    } catch (error) {
      throw classifyGeminiError(error);
    }
  }
}

export const geminiProvider = new GeminiProvider();
