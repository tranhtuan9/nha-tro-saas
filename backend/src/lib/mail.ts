import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// Lưu trữ email gửi cuối cùng để phục vụ kiểm thử
export let lastSentEmailForTest: SendMailOptions | null = null;

/**
 * Gửi email qua SMTP hoặc in ra console trong môi trường Dev/Test khi chưa cấu hình SMTP
 */
export async function sendMail(options: SendMailOptions): Promise<void> {
  lastSentEmailForTest = options;

  const smtpHost = process.env.SMTP_HOST;
  const mailFrom = process.env.MAIL_FROM || 'Quản lý nhà trọ <no-reply@example.com>';

  // Nếu chưa cấu hình SMTP_HOST (môi trường dev/test) -> In ra console
  if (!smtpHost) {
    console.log('\n[DEV MAIL] ========================================');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    if (options.text) console.log(`Text: ${options.text}`);
    if (options.html) console.log(`HTML: ${options.html}`);
    console.log('===================================================\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: mailFrom,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}
