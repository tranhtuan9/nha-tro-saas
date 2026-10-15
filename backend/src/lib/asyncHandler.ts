import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Bọc handler async để mọi lỗi (kể cả Promise rejection) được chuyển tới errorHandler.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
