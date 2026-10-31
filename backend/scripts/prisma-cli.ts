import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Chạy Prisma CLI với biến môi trường lấy từ backend/.env.
 *
 * Prisma CLI chỉ tự đọc .env cạnh schema, nên khi chạy
 * `prisma migrate`/`db seed` cần nạp backend/.env trước.
 */
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const prismaCli = require.resolve('prisma/build/index.js');
const child = spawn(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
