import { GoogleGenAI } from '@google/genai';
import { env } from '../src/config/env';

function summarize(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { raw: String(error) };
  }

  const err = error as Record<string, unknown>;
  return {
    name: err.name,
    message: err.message,
    status: err.status ?? err.statusCode,
    code: err.code,
    error: err.error,
    cause: err.cause ? String(err.cause) : undefined,
    keys: Object.keys(err),
    string: String(error).slice(0, 800),
  };
}

async function tryModel(model: string) {
  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: 'Reply with exactly: ok',
      config: {
        temperature: 0,
        // 3.x flash models can spend budget on internal reasoning; keep headroom.
        maxOutputTokens: 256,
        abortSignal: AbortSignal.timeout(25_000),
      },
    });
    return { model, ok: true as const, text: response.text?.slice(0, 80) ?? '' };
  } catch (error) {
    return { model, ok: false as const, error: summarize(error) };
  }
}

async function main() {
  console.log(
    JSON.stringify(
      {
        keyPrefix: env.geminiApiKey.slice(0, 6),
        keyLength: env.geminiApiKey.length,
        configuredModel: env.geminiModel,
        mockAi: env.mockAi,
      },
      null,
      2,
    ),
  );

  // Prefer lite/flash first for latency. Avoid gemini-flash-latest — it often hangs.
  const models = Array.from(
    new Set([
      env.geminiModel,
      'gemini-flash-lite-latest',
      'gemini-2.5-flash',
      'gemini-3.5-flash',
    ]),
  );

  for (const model of models) {
    const result = await tryModel(model);
    console.log(JSON.stringify(result, null, 2));
    if (result.ok) {
      break;
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify(summarize(error), null, 2));
  process.exit(1);
});
