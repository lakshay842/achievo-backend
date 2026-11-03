import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { coachChat, coachHistory, dailyMotivation } from './coach.service';

export const motivationHandler = asyncHandler(async (req: Request, res: Response) => {
  const message = await dailyMotivation(req.user!.id);
  return ApiResponse.success(res, 'Motivation ready', message);
});

export const coachHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.validated as { query: { conversationId?: string } };
  const result = await coachHistory(req.user!.id, query.conversationId);
  return ApiResponse.success(res, 'Coach history ready', result);
});

export const coachChatHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as {
    body: { message: string; conversationId?: string; goalId?: string };
  };
  const result = await coachChat(req.user!.id, body);
  return ApiResponse.success(res, 'Coach reply ready', result);
});
