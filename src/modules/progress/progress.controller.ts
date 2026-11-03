import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { getGoalProgress, getMonthly, getOverview, getStreak, getWeekly } from './progress.service';

export const overviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const overview = await getOverview(req.user!.id);
  return ApiResponse.success(res, 'Progress overview', overview);
});

export const goalProgressHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const progress = await getGoalProgress(req.user!.id, params.id);
  return ApiResponse.success(res, 'Goal progress', progress);
});

export const streaksHandler = asyncHandler(async (req: Request, res: Response) => {
  const streak = await getStreak(req.user!.id);
  return ApiResponse.success(res, 'Streaks loaded', streak);
});

export const weeklyHandler = asyncHandler(async (req: Request, res: Response) => {
  const weekly = await getWeekly(req.user!.id);
  return ApiResponse.success(res, 'Weekly progress', weekly);
});

export const monthlyHandler = asyncHandler(async (req: Request, res: Response) => {
  const monthly = await getMonthly(req.user!.id);
  return ApiResponse.success(res, 'Monthly progress', monthly);
});
