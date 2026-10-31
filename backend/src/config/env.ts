import dotenv from 'dotenv';
import path from 'path';

/**
 * Nạp biến môi trường từ backend/.env — MỘT nguồn duy nhất.
 *
 * Phải được import TRƯỚC @prisma/client (db.ts, jwt.ts...): generated client
 * của Prisma tự đọc backend/.env ngay khi import; biến rỗng ở đó sẽ "ghi nhớ"
 * vào process.env và dotenv không ghi đè nữa — nên ở đây dùng override: true
 * để giá trị ở backend/.env luôn thắng.
 */
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
