import { env } from './env';
import { AiProvider } from '../modules/ai/providers/ai-provider.interface';
import { geminiProvider } from '../modules/ai/providers/gemini.provider';
import { mockAiProvider } from '../modules/ai/providers/mock.provider';

let testOverride: AiProvider | null = null;

export const aiConfig = {
  get model() {
    return env.geminiModel;
  },
  get mock() {
    return env.mockAi;
  },
  get timeoutMs() {
    return env.aiTimeoutMs;
  },
};

export function getAiProvider(): AiProvider {
  if (testOverride) return testOverride;
  if (env.mockAi) return mockAiProvider;
  return geminiProvider;
}

export function setAiProviderForTests(provider: AiProvider | null): void {
  testOverride = provider;
}
