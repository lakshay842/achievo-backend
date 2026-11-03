import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { GoalStatus } from './goal.model';
import { getAssessment, toAssessmentDto } from '../assessments/assessment.service';
import { notFound } from '../../utils/ApiError';
import {
  GoalWriteInput,
  activateGoal,
  archiveGoal,
  createGoal,
  deleteGoal,
  getGoal,
  listGoals,
  pauseGoal,
  requireOwnedGoal,
  resumeGoal,
  updateGoal,
} from './goal.service';

export const createGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: GoalWriteInput };
  const goal = await createGoal(req.user!.id, body);
  return ApiResponse.created(res, 'Goal created', goal);
});

export const listGoalsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.validated as { query: { status?: GoalStatus; page?: number; limit?: number } };
  const result = await listGoals(req.user!.id, query);
  return ApiResponse.success(res, 'Goals loaded', result.items, 200, result.meta);
});

export const getGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const goal = await getGoal(req.user!.id, params.id);
  return ApiResponse.success(res, 'Goal loaded', goal);
});

export const assessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  await requireOwnedGoal(req.user!.id, params.id);
  const assessment = await getAssessment(req.user!.id, params.id);
  if (!assessment) throw notFound('Assessment');
  return ApiResponse.success(res, 'Assessment loaded', toAssessmentDto(assessment));
});

export const updateGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params, body } = req.validated as { params: { id: string }; body: Partial<GoalWriteInput> };
  const goal = await updateGoal(req.user!.id, params.id, body);
  return ApiResponse.success(res, 'Goal updated', goal);
});

export const pauseGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const goal = await pauseGoal(req.user!.id, params.id);
  return ApiResponse.success(res, 'Goal paused', goal);
});

export const resumeGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const goal = await resumeGoal(req.user!.id, params.id);
  return ApiResponse.success(res, 'Goal resumed', goal);
});

export const archiveGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const goal = await archiveGoal(req.user!.id, params.id);
  return ApiResponse.success(res, 'Goal archived', goal);
});

export const activateGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const goal = await activateGoal(req.user!.id, params.id);
  return ApiResponse.success(res, 'Goal activated', goal);
});

export const deleteGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const result = await deleteGoal(req.user!.id, params.id);
  return ApiResponse.success(res, 'Goal deleted', result);
});
