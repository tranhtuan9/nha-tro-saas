import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './modules/auth/routes';
import adminRoutes from './modules/admin/routes';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app: Application = express();

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

// Khởi chạy server nếu file được chạy trực tiếp
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

export default app;
