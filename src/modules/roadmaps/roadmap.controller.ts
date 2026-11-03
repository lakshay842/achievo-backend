import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { approveRoadmap, getRoadmap, listRoadmaps } from './roadmap.service';

export const listRoadmapsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.validated as { query: { goalId?: string } };
  const roadmaps = await listRoadmaps(req.user!.id, query.goalId);
  return ApiResponse.success(res, 'Roadmaps loaded', roadmaps);
});

export const getRoadmapHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params } = req.validated as { params: { id: string } };
  const roadmap = await getRoadmap(req.user!.id, params.id);
  return ApiResponse.success(res, 'Roadmap loaded', roadmap);
});

export const approveRoadmapHandler = asyncHandler(async (req: Request, res: Response) => {
  const { params, body } = req.validated as { params: { id: string }; body: { startDate?: string } };
  const roadmap = await approveRoadmap(req.user!.id, params.id, body.startDate);
  return ApiResponse.success(res, 'Roadmap approved', roadmap);
});
