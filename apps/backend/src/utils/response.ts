import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta && { meta }),
  });
};

export const sendCreated = <T>(res: Response, data: T, message: string = 'Created successfully'): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendError = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 400,
  errors?: string[]
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

export const sendUnauthorized = (res: Response, message: string = 'Unauthorized'): Response => {
  return sendError(res, message, 401);
};

export const sendForbidden = (res: Response, message: string = 'Access denied'): Response => {
  return sendError(res, message, 403);
};

export const sendNotFound = (res: Response, message: string = 'Resource not found'): Response => {
  return sendError(res, message, 404);
};

export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  message: string = 'Success'
): Response => {
  return sendSuccess(res, data, message, 200, {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
};

export const getPagination = (query: { page?: string; pageSize?: string; limit?: string }) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const pageSize = Math.min(
    parseInt(query.pageSize || query.limit || '20', 10),
    100
  );
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
};
