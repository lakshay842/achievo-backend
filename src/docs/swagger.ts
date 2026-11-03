export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ACHIEVO AI API',
    version: '1.0.0',
    description:
      'REST API for goals, roadmaps, daily tasks, progress, coaching, and notifications. The Gemini API key stays on the server.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health' },
    { name: 'Authentication' },
    { name: 'Users' },
    { name: 'Goals' },
    { name: 'Roadmaps' },
    { name: 'Tasks' },
    { name: 'AI' },
    { name: 'Coach' },
    { name: 'Progress' },
    { name: 'Notifications' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {},
          meta: { type: 'object' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          details: {},
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service and database health',
        responses: { '200': { description: 'Healthy' }, '503': { description: 'Database unavailable' } },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register with email and password',
        responses: { '201': { description: 'Account created' }, '409': { description: 'Email already registered' } },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login',
        responses: { '200': { description: 'Tokens issued' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        summary: 'Revoke the presented refresh token',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate a refresh token',
        responses: { '200': { description: 'New token pair' }, '401': { description: 'Invalid, expired, or reused token' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        summary: 'Current user',
        responses: { '200': { description: 'User' } },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Create a password reset token',
        responses: { '200': { description: 'Generic response. The token is returned only outside production.' } },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset a password and revoke sessions',
        responses: { '200': { description: 'Password updated' }, '400': { description: 'Invalid token' } },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Profile and notification preferences',
        responses: { '200': { description: 'Profile' } },
      },
      patch: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Update name or timezone',
        responses: { '200': { description: 'Updated profile' } },
      },
    },
    '/api/v1/goals': {
      post: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'Create a goal',
        responses: { '201': { description: 'Goal created' } },
      },
      get: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'List the authenticated user goals',
        responses: { '200': { description: 'Paginated goals' } },
      },
    },
    '/api/v1/goals/{id}/assessment': {
      get: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'Latest AI assessment for an owned goal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Assessment' }, '404': { description: 'Not found' } },
      },
    },
    '/api/v1/goals/{id}': {
      get: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'Get one owned goal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Goal' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'Update an owned goal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated' } },
      },
    },
    '/api/v1/goals/{id}/pause': {
      post: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'Pause an active goal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Paused' } },
      },
    },
    '/api/v1/goals/{id}/resume': {
      post: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'Resume a paused goal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Resumed' } },
      },
    },
    '/api/v1/goals/{id}/archive': {
      post: {
        tags: ['Goals'],
        security: [{ bearerAuth: [] }],
        summary: 'Archive a goal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Archived' } },
      },
    },
    '/api/v1/roadmaps': {
      get: {
        tags: ['Roadmaps'],
        security: [{ bearerAuth: [] }],
        summary: 'List roadmap versions',
        responses: { '200': { description: 'Roadmaps' } },
      },
    },
    '/api/v1/roadmaps/{id}': {
      get: {
        tags: ['Roadmaps'],
        security: [{ bearerAuth: [] }],
        summary: 'Get a roadmap with milestones and tasks',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Roadmap' } },
      },
    },
    '/api/v1/roadmaps/{id}/approve': {
      post: {
        tags: ['Roadmaps'],
        security: [{ bearerAuth: [] }],
        summary: 'Approve a draft roadmap and schedule its tasks',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Approved' }, '409': { description: 'Not a draft or deadline exceeded' } },
      },
    },
    '/api/v1/tasks/today': {
      get: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'Tasks scheduled for the user local today',
        responses: { '200': { description: 'Today' } },
      },
    },
    '/api/v1/tasks': {
      get: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'List owned tasks',
        responses: { '200': { description: 'Tasks' } },
      },
    },
    '/api/v1/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'Get one owned task',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Task' } },
      },
    },
    '/api/v1/tasks/{id}/start': {
      post: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'Start a pending task',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Started' } },
      },
    },
    '/api/v1/tasks/{id}/complete': {
      post: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'Complete a task once',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Completed' }, '409': { description: 'Already completed' } },
      },
    },
    '/api/v1/tasks/{id}/skip': {
      post: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'Skip a task',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Skipped' } },
      },
    },
    '/api/v1/tasks/{id}/reschedule': {
      post: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'Move a task inside the approved window',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Rescheduled' }, '409': { description: 'Significant change requires replan approval' } },
      },
    },
    '/api/v1/tasks/{id}/feedback': {
      post: {
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        summary: 'Save difficulty feedback',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Saved' } },
      },
    },
    '/api/v1/ai/goals/analyze': {
      post: {
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        summary: 'Analyze a goal and store clarification questions',
        responses: { '200': { description: 'Analysis' }, '429': { description: 'Quota or rate limit' } },
      },
    },
    '/api/v1/ai/goals/clarify': {
      post: {
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        summary: 'Apply clarification answers',
        responses: { '200': { description: 'Updated assessment' } },
      },
    },
    '/api/v1/ai/roadmaps/generate': {
      post: {
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        summary: 'Generate a draft roadmap. It is not approved automatically.',
        responses: { '201': { description: 'Draft roadmap' }, '422': { description: 'Clarification still required' } },
      },
    },
    '/api/v1/ai/roadmaps/{id}/replan': {
      post: {
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        summary: 'Create an adjusted draft without changing the approved schedule',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Draft that still requires approval' } },
      },
    },
    '/api/v1/ai/chat': {
      post: {
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        summary: 'Context-aware coaching chat',
        responses: { '200': { description: 'Reply' } },
      },
    },
    '/api/v1/ai/tasks/{taskId}/explain': {
      post: {
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        summary: 'Explain an owned task',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Explanation' } },
      },
    },
    '/api/v1/ai/tasks/{taskId}/evaluate': {
      post: {
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        summary: 'Evaluate submitted task work',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Evaluation' } },
      },
    },
    '/api/v1/coach/motivation': {
      get: {
        tags: ['Coach'],
        security: [{ bearerAuth: [] }],
        summary: 'Personalized encouragement based on recent behavior',
        responses: { '200': { description: 'Message' } },
      },
    },
    '/api/v1/coach/chat': {
      post: {
        tags: ['Coach'],
        security: [{ bearerAuth: [] }],
        summary: 'Coaching chat',
        responses: { '200': { description: 'Reply' } },
      },
    },
    '/api/v1/coach/chat/history': {
      get: {
        tags: ['Coach'],
        security: [{ bearerAuth: [] }],
        summary: 'Latest coach conversation with message timestamps',
        parameters: [
          {
            name: 'conversationId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'Conversation history' } },
      },
    },
    '/api/v1/progress/overview': {
      get: {
        tags: ['Progress'],
        security: [{ bearerAuth: [] }],
        summary: 'Overall completion, time, and streak',
        responses: { '200': { description: 'Overview' } },
      },
    },
    '/api/v1/progress/goals/{id}': {
      get: {
        tags: ['Progress'],
        security: [{ bearerAuth: [] }],
        summary: 'Progress for one goal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Goal progress' } },
      },
    },
    '/api/v1/progress/streaks': {
      get: {
        tags: ['Progress'],
        security: [{ bearerAuth: [] }],
        summary: 'Current and longest streak',
        responses: { '200': { description: 'Streaks' } },
      },
    },
    '/api/v1/progress/weekly': {
      get: {
        tags: ['Progress'],
        security: [{ bearerAuth: [] }],
        summary: 'Current week in the user timezone',
        responses: { '200': { description: 'Weekly progress' } },
      },
    },
    '/api/v1/progress/monthly': {
      get: {
        tags: ['Progress'],
        security: [{ bearerAuth: [] }],
        summary: 'Current month in the user timezone',
        responses: { '200': { description: 'Monthly progress' } },
      },
    },
    '/api/v1/notifications/device-token': {
      post: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        summary: 'Register an Expo push token',
        responses: { '200': { description: 'Saved' }, '400': { description: 'Invalid token' } },
      },
    },
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        summary: 'List notification delivery attempts',
        responses: { '200': { description: 'Notifications' } },
      },
    },
    '/api/v1/notifications/preferences': {
      patch: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        summary: 'Update notification preferences',
        responses: { '200': { description: 'Preferences' } },
      },
    },
    '/api/v1/notifications/test': {
      post: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        summary: 'Send a local test notification',
        responses: { '200': { description: 'Processed' } },
      },
    },
    '/api/v1/notifications/motivation': {
      post: {
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        summary: 'Send a motivation reminder push now',
        responses: { '200': { description: 'Queued' }, '400': { description: 'Notifications disabled' } },
      },
    },
  },
};
