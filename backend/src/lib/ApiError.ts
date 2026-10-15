/**
 * Lỗi nghiệp vụ có cấu trúc, được xử lý tập trung bởi errorHandler.
 * `code` là mã ổn định (không đổi) để phía client phân nhánh xử lý.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(401, code, message, details);
  }

  static forbidden(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(403, code, message, details);
  }

  static notFound(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(404, code, message, details);
  }

  static conflict(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(409, code, message, details);
  }

  static internal(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(500, code, message, details);
  }
}
