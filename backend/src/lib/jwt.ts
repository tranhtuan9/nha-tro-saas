import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET chưa được cấu hình trong file .env');
  }
  return secret;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  tenantId: string | null;
}

/**
 * Tạo JWT token với thuật toán HS256 chỉ định rõ ràng
 */
export function signToken(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn,
  });
}

/**
 * Xác thực và giải mã JWT token với thuật toán HS256 chỉ định rõ ràng
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
  });
  return decoded as unknown as JwtPayload;
}
