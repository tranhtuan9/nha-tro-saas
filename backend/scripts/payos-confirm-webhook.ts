import path from 'path';
import dotenv from 'dotenv';
import { PayOS } from '@payos/node';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Đăng ký URL webhook với payOS (PAYOS_WEBHOOK_URL trong .env, cần URL công khai
 * qua Cloudflare Tunnel/ngrok trỏ về POST /api/webhooks/payos).
 * Chạy: npm run payos:confirm-webhook
 */
async function main(): Promise<void> {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const webhookUrl = process.env.PAYOS_WEBHOOK_URL;
  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('Thiếu PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY trong .env');
  }
  if (!webhookUrl) {
    throw new Error('Thiếu PAYOS_WEBHOOK_URL trong .env');
  }

  const confirmedUrl = webhookUrl.replace(/\/+$/, '').endsWith('/api/webhooks/payos')
    ? webhookUrl
    : `${webhookUrl.replace(/\/+$/, '')}/api/webhooks/payos`;

  const payos = new PayOS({ clientId, apiKey, checksumKey });
  const result = await payos.webhooks.confirm(confirmedUrl);
  console.log('Đăng ký webhook OK:', result.webhookUrl);
  console.log('Tài khoản nhận tiền:', result.accountName, result.accountNumber);
}

main().catch((err) => {
  console.error('Đăng ký webhook payOS thất bại:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
