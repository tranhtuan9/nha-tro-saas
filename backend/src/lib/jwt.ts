import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET chưa được cấu hình trong file .env');
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
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn,
  });
}

/**
 * Xác thực và giải mã JWT token với thuật toán HS256 chỉ định rõ ràng
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  }) as JwtPayload;
}
