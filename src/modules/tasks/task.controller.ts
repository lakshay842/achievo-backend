import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { TaskStatus } from './task.model';
import {
  completeTask,
  getTask,
  listTasks,
  rescheduleTask,
  saveFeedback,
  skipTask,
  startTask,
  tasksForToday,
} from './task.service';

export const todayHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await tasksForToday(req.user!.id);
  return ApiResponse.success(res, 'Today loaded', result);
});

export const listTasksHandler = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.validated as {
    query: { status?: TaskStatus; goalId?: string; from?: string; to?: string; page?: number; limit?: number };
  };
  const result = await listTasks(req.user!.id, query);
  return ApiResponse.success(res, 'Tasks loaded', result.items, 200, result.meta);
});

export const getTaskHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const task = await getTask(req.user!.id, params.id);
  return ApiResponse.success(res, 'Task loaded', task);
});

export const startTaskHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const task = await startTask(req.user!.id, params.id);
  return ApiResponse.success(res, 'Task started', task);
});

export const completeTaskHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const task = await completeTask(req.user!.id, params.id);
  return ApiResponse.success(res, 'Task completed', task);
});

export const skipTaskHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const task = await skipTask(req.user!.id, params.id);
  return ApiResponse.success(res, 'Task skipped', task);
});

export const rescheduleTaskHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params, body } = req.validated as { params: { id: string }; body: { taskDate: string } };
  const task = await rescheduleTask(req.user!.id, params.id, body.taskDate);
  return ApiResponse.success(res, 'Task rescheduled', task);
});

export const feedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params, body } = req.validated as {
    params: { id: string };
    body: { difficulty: 'easy' | 'moderate' | 'hard'; note?: string };
  };
  const task = await saveFeedback(req.user!.id, params.id, body);
  return ApiResponse.success(res, 'Feedback saved', task);
});
