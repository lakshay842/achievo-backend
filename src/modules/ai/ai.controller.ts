import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { replanRoadmap } from './services/adaptive-planner.service';
import { chatWithCoach, evaluateTask, explainTask } from './services/coach-chat.service';
import { analyzeGoal, clarifyGoal } from './services/goal-analyzer.service';
import { generateRoadmap } from './services/roadmap-generator.service';

export const analyzeHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: Parameters<typeof analyzeGoal>[1] };
  const result = await analyzeGoal(req.user!.id, body);
  return ApiResponse.success(res, 'Goal analyzed', result);
});

export const clarifyHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: Parameters<typeof clarifyGoal>[1] };
  const result = await clarifyGoal(req.user!.id, body);
  return ApiResponse.success(res, 'Clarification saved', result);
});

export const generateHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: { goalId: string } };
  const roadmap = await generateRoadmap(req.user!.id, body.goalId);
  return ApiResponse.created(res, 'Roadmap draft created', roadmap);
});

export const replanHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const roadmap = await replanRoadmap(req.user!.id, params.id);
  return ApiResponse.created(res, 'Replanned roadmap draft created', roadmap);
});

export const chatHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as {
    body: { message: string; conversationId?: string; goalId?: string };
  };
  const result = await chatWithCoach(req.user!.id, body);
  return ApiResponse.success(res, 'Coach reply ready', result);
});

export const explainHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { taskId: string } };
  const result = await explainTask(req.user!.id, params.taskId);
  return ApiResponse.success(res, 'Task explanation ready', result);
});

export const evaluateHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params, body } = req.validated as { params: { taskId: string }; body: { submission: string } };
  const result = await evaluateTask(req.user!.id, params.taskId, body.submission);
  return ApiResponse.success(res, 'Task evaluated', result);
});
