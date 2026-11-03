import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { getProfile, updateProfile } from './user.service';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const profile = await getProfile(req.user!.id);
  return ApiResponse.success(res, 'Profile loaded', profile);
});

export const patchMe = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: { name?: string; timezone?: string } };
  const profile = await updateProfile(req.user!.id, body);
  return ApiResponse.success(res, 'Profile updated', profile);
});
