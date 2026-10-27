import app from './app';
import { checkAppDbRole } from './startup/checkDbRole';

const PORT = process.env.PORT || 4000;

async function start() {
  const roleCheck = await checkAppDbRole();
  if (!roleCheck.ok) {
    console.error('[startup] Kiểm tra role DB thất bại:');
    console.error(roleCheck.message);
    process.exit(1);
  }
  console.log('[startup]', roleCheck.message);

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[startup] Lỗi khởi động:', err);
  process.exit(1);
});
