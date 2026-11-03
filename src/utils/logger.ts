import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

export const logger = pino({
  level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
      'req.body.token',
      'password',
      'passwordHash',
      'refreshToken',
      'accessToken',
      'apiKey',
      'GEMINI_API_KEY',
      '*.password',
      '*.passwordHash',
      '*.refreshToken',
      '*.accessToken',
      '*.token',
      '*.apiKey',
    ],
    censor: '[redacted]',
  },
});
