import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      PORT: '5050',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/achievo_ai_test',
      JWT_ACCESS_SECRET: 'test-access-secret-value',
      JWT_REFRESH_SECRET: 'test-refresh-secret-value',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'gemini-3.6-flash',
      MOCK_AI: 'true',
      FRONTEND_ORIGIN: 'http://localhost:8081',
      AI_TIMEOUT_MS: '5000',
      LOG_LEVEL: 'silent',
      NOTIFICATIONS_DRY_RUN: 'true',
    },
  },
});
