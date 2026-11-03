# ACHIEVO AI API

Backend for ACHIEVO AI. It is a Node.js REST API for accounts, goals, draft roadmaps, daily tasks, progress, coaching, and Expo push notifications. The mobile app lives in a separate project and is not part of this service.

## Stack

Node.js, Express, TypeScript, MongoDB, Mongoose, Zod, JWT, Argon2id, the official `@google/genai` SDK, Expo push notifications, Swagger, Helmet, express-rate-limit, and Pino.

## Setup

```bash
cd achievo-backend
cp .env.example .env
# Fill JWT_ACCESS_SECRET and JWT_REFRESH_SECRET with long random values.
npm install
npm run dev
```

The API listens on port 5000 by default.

- Health: `GET /health`
- OpenAPI UI: `GET /api-docs`

MongoDB can be local (`mongodb://127.0.0.1:27017/achievo_ai`) or MongoDB Atlas (`mongodb+srv://...`). The URI is read from the environment and is not written to logs.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start with reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | TypeScript check |
| `npm test` | API tests against MongoDB |
| `npm run seed` | Create `demo@achievo.local` / `Password123!` when that email is free |

Tests expect MongoDB on `mongodb://127.0.0.1:27017/achievo_ai_test`. They delete documents in that database.

## Authentication

Email and password only. Passwords are hashed with Argon2id. Access tokens are short lived. Refresh tokens rotate, are stored as SHA-256 hashes, and a reused refresh token revokes the user's sessions. Logout revokes the presented refresh token. Responses never include password hashes.

`POST /api/v1/auth/forgot-password` stores a hashed reset token. Outside production the raw token is returned so the flow can be tested without an email provider. Production returns only a generic message. Resetting a password revokes refresh sessions.

The user id used for authorization always comes from the access token.

## Goals, roadmaps, and tasks

Goals belong to the authenticated user. Reads and writes that do not match the owner return 404.

`POST /api/v1/ai/roadmaps/generate` validates the model JSON and saves a **draft**. Nothing is scheduled until `POST /api/v1/roadmaps/:id/approve`. Older approved versions are kept. Incomplete tasks on a replaced roadmap are marked superseded and are not deleted. Completed tasks stay in history.

A small reschedule inside the approved window is applied immediately. Moving a task outside that window, or by more than 7 days, is rejected until a replanned draft is approved. Replan does not change an approved deadline by itself.

Task completion is an atomic status change. A second completion returns 409.

## AI

`MOCK_AI=true` uses the built-in provider. `MOCK_AI=false` calls Gemini through `@google/genai` with `GEMINI_MODEL`. The model name is configuration, not a hardcoded fallback. Rate limits, quota errors, invalid JSON, network errors, and timeouts are returned as API errors. A failed Gemini call is never replaced with a mock result.

The API key stays in server environment variables.

Motivation copy is chosen from the user's streak, missed work, and milestone progress. The wording is fixed so it stays specific and does not shame the user. Coaching chat, task explanations, and task evaluation use the configured AI provider.

## Notifications

The process checks once a minute for reminders that are due in each user's timezone. Preferences can turn each type off. Delivery attempts and status are stored. Invalid Expo tokens are marked invalid. `NOTIFICATIONS_DRY_RUN=true` records the delivery locally, which is the development default, so a test send does not need a paid push service.

## Progress

Overview, goal, streak, weekly, and monthly routes use the user's timezone. Streaks increase when a task is completed on a new local day and reset when a day is missed.

## Deployment

`render.yaml` builds with `npm run build`, starts with `npm start`, and uses `GET /health`. Set `MONGODB_URI` to an Atlas connection string and set the secrets in the Render dashboard. Do not commit a real `.env`.

This service does not keep a host awake. If the chosen instance sleeps, use a hosting plan that stays up or an external check against `/health`.

## Status

Phases 1–7 are implemented: server and MongoDB, authentication, goals and roadmap approval, tasks and progress, Gemini coaching and replanning, notifications, tests, and the Render config.
