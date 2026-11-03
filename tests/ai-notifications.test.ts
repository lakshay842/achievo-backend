import { describe, expect, it, afterEach } from 'vitest';
import { setAiProviderForTests } from '../src/config/ai';
import { AiError, classifyGeminiError } from '../src/modules/ai/providers/ai-error';
import { composeMotivation } from '../src/modules/ai/services/motivation.service';
import { DeviceTokenModel } from '../src/modules/notifications/device-token.model';
import { RoadmapModel } from '../src/modules/roadmaps/roadmap.model';
import { validateRoadmapPlan, buildMockPlan } from './roadmap-fixtures';
import { processDueNotifications } from '../src/jobs/reminder.processor';
import { api, authHeader, registerUser } from './helpers';

describe('AI and notifications', () => {
  afterEach(() => {
    setAiProviderForTests(null);
  });

  it('uses the mock provider and does not substitute it when Gemini quota fails', async () => {
    const user = await registerUser('ai@achievo.test');
    const headers = authHeader(user.body.data.accessToken);
    const goal = await api().post('/api/v1/goals').set(headers).send({
      title: 'Learn Java',
      description: 'I know variables.',
      availableMinutesPerDay: 60,
      durationDays: 2,
    });

    const analyzed = await api().post('/api/v1/ai/goals/analyze').set(headers).send({
      goalId: goal.body.data.id,
      title: 'Learn Java',
      description: 'I know variables.',
      availableMinutesPerDay: 60,
      durationDays: 2,
    });
    expect(analyzed.status).toBe(200);
    expect(analyzed.body.data.assessment.status).toBe('ready');

    const assessment = await api().get(`/api/v1/goals/${goal.body.data.id}/assessment`).set(headers);
    expect(assessment.status).toBe(200);
    expect(assessment.body.data.goalId).toBe(goal.body.data.id);

    setAiProviderForTests({
      name: 'gemini',
      async complete() {
        throw new AiError('QUOTA', 'AI quota exceeded');
      },
    });

    const failed = await api().post('/api/v1/ai/roadmaps/generate').set(headers).send({ goalId: goal.body.data.id });
    expect(failed.status).toBe(429);
    expect(failed.body.details.code).toBe('QUOTA');
    expect(failed.body.data).toBeUndefined();
    expect(await RoadmapModel.countDocuments({ goalId: goal.body.data.id })).toBe(0);

    const quota = classifyGeminiError(Object.assign(new Error('RESOURCE_EXHAUSTED quota exceeded'), { status: 429 }));
    expect(quota.code).toBe('QUOTA');
  });

  it('writes kind motivation and schedules one daily notification', async () => {
    const consistent = composeMotivation({
      currentStreak: 7,
      missedYesterday: 0,
      completedToday: 1,
    });
    expect(consistent.message).toContain('7 days consistently');

    const missed = composeMotivation({ currentStreak: 0, missedYesterday: 1, completedToday: 0 });
    expect(missed.message).toContain("Let's restart with one small task");
    expect(missed.message.toLowerCase()).not.toContain('shame');
    expect(missed.message.toLowerCase()).not.toContain('lazy');

    const near = composeMotivation({
      currentStreak: 1,
      missedYesterday: 0,
      completedToday: 0,
      milestoneTitle: 'Java Fundamentals',
      milestonePercent: 85,
    });
    expect(near.message).toContain('close to completing');

    const user = await registerUser('notify@achievo.test');
    const headers = authHeader(user.body.data.accessToken);
    const token = await api().post('/api/v1/notifications/device-token').set(headers).send({
      token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'android',
    });
    expect(token.status).toBe(200);

    const preferences = await api().patch('/api/v1/notifications/preferences').set(headers).send({
      dailyReminderTime: '00:00',
    });
    expect(preferences.status).toBe(200);

    const first = await processDueNotifications(new Date('2026-11-02T09:00:00.000Z'));
    expect(first.created).toBe(1);
    expect(first.sent).toBe(1);

    const second = await processDueNotifications(new Date('2026-11-02T09:05:00.000Z'));
    expect(second.created).toBe(0);

    const list = await api().get('/api/v1/notifications').set(headers);
    expect(list.body.data[0].status).toBe('sent');
    expect(list.body.data[0].attempts.length).toBeGreaterThan(0);
  });

  it('marks an invalid device token when delivery is attempted', async () => {
    const user = await registerUser('invalid-token@achievo.test');
    await DeviceTokenModel.create({
      userId: user.body.data.user.id,
      token: 'not-a-real-token',
      platform: 'ios',
      invalid: false,
    });

    const response = await api().post('/api/v1/notifications/test').set(authHeader(user.body.data.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('failed');

    const stored = await DeviceTokenModel.findOne({ token: 'not-a-real-token' });
    expect(stored?.invalid).toBe(true);
  });

  it('rejects a roadmap that skips a day', () => {
    const errors = validateRoadmapPlan(buildMockPlan(), { durationDays: 2, dailyMinutes: 60 });
    expect(errors.some((error) => error.includes('Missing tasks for day 2'))).toBe(true);
  });
});
