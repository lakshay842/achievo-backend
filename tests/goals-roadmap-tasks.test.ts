import { describe, expect, it } from 'vitest';
import { TaskProgressModel } from '../src/modules/tasks/task-progress.model';
import { api, authHeader, registerUser } from './helpers';

describe('goals, roadmaps, tasks, and progress', () => {
  it('keeps goals private and completes an approved task once', async () => {
    const owner = await registerUser('owner@achievo.test');
    const other = await registerUser('other@achievo.test');
    const ownerAuth = authHeader(owner.body.data.accessToken);
    const otherAuth = authHeader(other.body.data.accessToken);

    const created = await api().post('/api/v1/goals').set(ownerAuth).send({
      title: 'Learn Java',
      description: 'I can write small programs already.',
      category: 'education',
      availableMinutesPerDay: 60,
      durationDays: 4,
    });
    expect(created.status).toBe(201);
    const goalId = created.body.data.id as string;

    const hidden = await api().get(`/api/v1/goals/${goalId}`).set(otherAuth);
    expect(hidden.status).toBe(404);

    const generated = await api().post('/api/v1/ai/roadmaps/generate').set(ownerAuth).send({ goalId });
    expect(generated.status).toBe(201);
    expect(generated.body.data.status).toBe('draft');
    expect(generated.body.data.source).toBe('mock');
    expect(generated.body.data.milestones[0].tasks[0].isActive).toBe(false);

    const approved = await api().post(`/api/v1/roadmaps/${generated.body.data.id}/approve`).set(ownerAuth).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('approved');

    const today = await api().get('/api/v1/tasks/today').set(ownerAuth);
    expect(today.status).toBe(200);
    expect(today.body.data.tasks.length).toBeGreaterThan(0);
    const taskId = today.body.data.tasks[0].id as string;

    const otherComplete = await api().post(`/api/v1/tasks/${taskId}/complete`).set(otherAuth);
    expect(otherComplete.status).toBe(404);

    const completed = await api().post(`/api/v1/tasks/${taskId}/complete`).set(ownerAuth);
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('completed');

    const duplicate = await api().post(`/api/v1/tasks/${taskId}/complete`).set(ownerAuth);
    expect(duplicate.status).toBe(409);
    expect(await TaskProgressModel.countDocuments({ taskId, type: 'complete' })).toBe(1);

    const overview = await api().get('/api/v1/progress/overview').set(ownerAuth);
    expect(overview.status).toBe(200);
    expect(overview.body.data.completedTasks).toBe(1);
    expect(overview.body.data.pendingTasks).toBe(3);
    expect(overview.body.data.currentStreak).toBe(1);
    expect(overview.body.data.timeInvestedMinutes).toBe(60);

    const goalProgress = await api().get(`/api/v1/progress/goals/${goalId}`).set(ownerAuth);
    expect(goalProgress.status).toBe(200);
    expect(goalProgress.body.data.completionPercentage).toBe(25);

    const weekly = await api().get('/api/v1/progress/weekly').set(ownerAuth);
    expect(weekly.body.data.completedTasks).toBe(1);
    const monthly = await api().get('/api/v1/progress/monthly').set(ownerAuth);
    expect(monthly.body.data.completedTasks).toBe(1);
  });

  it('keeps roadmap history when a replan draft is created', async () => {
    const owner = await registerUser('planner@achievo.test');
    const ownerAuth = authHeader(owner.body.data.accessToken);
    const goal = await api().post('/api/v1/goals').set(ownerAuth).send({
      title: 'Learn Java',
      description: 'Daily practice.',
      availableMinutesPerDay: 45,
      durationDays: 3,
    });
    const generated = await api().post('/api/v1/ai/roadmaps/generate').set(ownerAuth).send({
      goalId: goal.body.data.id,
    });
    await api().post(`/api/v1/roadmaps/${generated.body.data.id}/approve`).set(ownerAuth).send({});

    const replanned = await api().post(`/api/v1/ai/roadmaps/${generated.body.data.id}/replan`).set(ownerAuth).send({});
    expect(replanned.status).toBe(201);
    expect(replanned.body.data.status).toBe('draft');
    expect(replanned.body.data.requiresApproval).toBe(true);
    expect(replanned.body.data.version).toBe(2);

    const original = await api().get(`/api/v1/roadmaps/${generated.body.data.id}`).set(ownerAuth);
    expect(original.body.data.status).toBe('approved');
    expect(original.body.data.milestones[0].tasks.length).toBeGreaterThan(0);
  });
});
