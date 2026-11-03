import { Response } from 'express';

export class ApiResponse {
  static success(
    res: Response,
    message: string,
    data?: unknown,
    statusCode = 200,
    meta?: Record<string, unknown>,
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null,
      ...(meta ? { meta } : {}),
    });
  }

  static created(res: Response, message: string, data?: unknown) {
    return this.success(res, message, data, 201);
  }
}
