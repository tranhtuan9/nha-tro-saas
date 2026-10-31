import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './modules/auth/routes';
import adminRoutes from './modules/admin/routes';
import propertyRoutes from './modules/properties/routes';
import roomRoutes from './modules/rooms/routes';
import renterRoutes from './modules/renters/routes';
import contractRoutes from './modules/contracts/routes';
import serviceRoutes from './modules/services/routes';
import meterReadingRoutes from './modules/meter-readings/routes';
import invoiceRoutes from './modules/invoices/routes';
import paymentRoutes from './modules/payments/routes';
import { handlePayosWebhook } from './modules/payments/webhook';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

// Webhook payOS: đăng ký TRƯỚC express.json() chung — JSON riêng, giới hạn 16kb;
// chữ ký xác thực bằng SDK trên object đã parse nên không cần giữ raw body.
app.post('/api/webhooks/payos', express.json({ limit: '16kb' }), handlePayosWebhook);

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
app.use('/api/renters', renterRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/meter-readings', meterReadingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);

// 404 cho mọi route không khớp
app.use(notFoundHandler);

// Xử lý lỗi toàn cục (đặt cuối cùng)
app.use(errorHandler);

export default app;
