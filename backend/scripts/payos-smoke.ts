import path from 'path';
import dotenv from 'dotenv';
import { PayOS } from '@payos/node';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Kiểm tra nhanh khóa payOS sandbox: tạo một link thử rồi hủy ngay
 * (KHÔNG đụng CSDL, không nằm trong npm test).
 * Chạy: npm run payos:smoke
 */
async function main(): Promise<void> {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('Thiếu PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY trong .env');
  }

  const payos = new PayOS({ clientId, apiKey, checksumKey });
  const orderCode = Math.floor(Date.now() / 1000) % 1_000_000_000;
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const link = await payos.paymentRequests.create({
    orderCode,
    amount: 2000,
    description: `SMOKE ${orderCode}`.slice(0, 25),
    returnUrl: `${frontend}/payments/result?paymentId=smoke`,
    cancelUrl: `${frontend}/payments/result?paymentId=smoke`,
  });
  console.log('Tạo link thử OK:', { orderCode: link.orderCode, status: link.status });
  console.log('checkoutUrl:', link.checkoutUrl);

  const cancelled = await payos.paymentRequests.cancel(orderCode, 'Smoke test');
  console.log('Hủy link thử OK:', { status: cancelled.status });
}

main().catch((err) => {
  console.error('Smoke test payOS thất bại:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
