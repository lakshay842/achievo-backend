import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { forgotPassword, login, logout, me, refresh, register, resetPassword } from './auth.service';
import { LoginInput, RegisterInput } from './auth.validation';

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: RegisterInput };
  const result = await register(body);
  return ApiResponse.created(res, 'Account created', result);
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: LoginInput };
  const result = await login(body);
  return ApiResponse.success(res, 'Logged in', result);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: { refreshToken: string } };
  await logout(req.user!.id, body.refreshToken);
  return ApiResponse.success(res, 'Logged out');
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: { refreshToken: string } };
  const tokens = await refresh(body.refreshToken);
  return ApiResponse.success(res, 'Token refreshed', tokens);
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await me(req.user!.id);
  return ApiResponse.success(res, 'Current user', user);
});

export const forgotPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: { email: string } };
  const result = await forgotPassword(body.email);
  return ApiResponse.success(res, 'If the account exists, password reset instructions are ready', result);
});

export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { body } = req.validated as { body: { token: string; password: string } };
  await resetPassword(body.token, body.password);
  return ApiResponse.success(res, 'Password updated');
});
