import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  listNotifications,
  registerDeviceToken,
  sendMotivationPush,
  sendTestNotification,
  updatePreferences,
} from './notification.service';

export const deviceTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: { token: string; platform?: 'ios' | 'android' | 'unknown' } };
  const device = await registerDeviceToken(req.user!.id, body.token, body.platform ?? 'unknown');
  return ApiResponse.success(res, 'Device token saved', device);
});

export const listHandler = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.validated as { query: { page?: number; limit?: number } };
  const result = await listNotifications(req.user!.id, query);
  return ApiResponse.success(res, 'Notifications loaded', result.items, 200, result.meta);
});

export const preferencesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as {
    body: Parameters<typeof updatePreferences>[1];
  };
  const preferences = await updatePreferences(req.user!.id, body);
  return ApiResponse.success(res, 'Notification preferences updated', preferences);
});

export const testHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await sendTestNotification(req.user!.id);
  return ApiResponse.success(res, 'Test notification processed', notification);
});

export const motivationPushHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await sendMotivationPush(req.user!.id);
  return ApiResponse.success(res, 'Motivation reminder queued', notification);
});
