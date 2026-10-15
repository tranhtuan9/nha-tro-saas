import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './modules/auth/routes';
import adminRoutes from './modules/admin/routes';
import propertyRoutes from './modules/properties/routes';
import roomRoutes from './modules/rooms/routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app: Application = express();

// Bảo mật HTTP headers
app.use(helmet());

// CORS: chỉ cho phép Frontend URL đã cấu hình
const frontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: frontendOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middlewares cơ bản
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Đăng ký các module routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/rooms', roomRoutes);

// 404 cho mọi route không khớp
app.use(notFoundHandler);

// Xử lý lỗi toàn cục (đặt cuối cùng)
app.use(errorHandler);

// Khởi chạy server nếu file được chạy trực tiếp
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

export default app;
