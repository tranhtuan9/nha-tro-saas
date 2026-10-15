import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/ApiError';

/**
 * Bắt mọi route không khớp -> 404 theo định dạng lỗi thống nhất.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Không tìm thấy tài nguyên yêu cầu',
    },
  });
}

/**
 * Middleware xử lý lỗi toàn cục.
 * Định dạng phản hồi thống nhất: { error: { code, message, details? } }
 * - Không lộ stack/SQL ra ngoài với lỗi 500.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: err.errors,
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Dữ liệu đã tồn tại, vi phạm ràng buộc duy nhất',
          details: err.meta,
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi' },
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Ràng buộc dữ liệu liên quan bị vi phạm',
        },
      });
      return;
    }
  }

  // Lỗi không mong đợi: ghi log phía server, KHÔNG lộ chi tiết ra client.
  console.error('[UnhandledError]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Lỗi hệ thống. Vui lòng thử lại sau.',
    },
  });
}
