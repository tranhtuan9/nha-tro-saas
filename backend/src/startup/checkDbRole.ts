import { PrismaClient } from '@prisma/client';

export interface DbRoleCheckResult {
  ok: boolean;
  message: string;
  role?: string;
  isSuperuser?: boolean;
  isBypassRls?: boolean;
}

/**
 * Kiểm tra role kết nối của APP_DATABASE_URL:
 * - Phải thuộc role KHÔNG phải superuser
 * - KHÔNG được có BYPASSRLS
 * Nếu vi phạm → trả về kết quả thất bại với thông báo rõ ràng
 */
export async function checkAppDbRole(): Promise<DbRoleCheckResult> {
  const appDbUrl = process.env.APP_DATABASE_URL;
  if (!appDbUrl) {
    return {
      ok: false,
      message: 'APP_DATABASE_URL chưa được cấu hình trong biến môi trường',
    };
  }

  const prisma = new PrismaClient({
    datasourceUrl: appDbUrl,
  });

  try {
    const result = await prisma.$queryRaw<Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `;

    if (!result || result.length === 0) {
      return {
        ok: false,
        message: 'Không xác định được role hiện tại của APP_DATABASE_URL',
      };
    }

    const role = result[0];
    if (role.rolsuper) {
      return {
        ok: false,
        message: 'Từ chối khởi động: APP_DATABASE_URL đang kết nối bằng superuser (rolsuper = true). Chỉ được dùng role app_user không superuser.',
        role: role.rolname,
        isSuperuser: role.rolsuper,
        isBypassRls: role.rolbypassrls,
      };
    }

    if (role.rolbypassrls) {
      return {
        ok: false,
        message: 'Từ chối khởi động: APP_DATABASE_URL đang kết nối bằng role có BYPASSRLS (rolbypassrls = true). app_user phải bị cưỡng chế bởi RLS.',
        role: role.rolname,
        isSuperuser: role.rolsuper,
        isBypassRls: role.rolbypassrls,
      };
    }

    return {
      ok: true,
      message: `OK: APP_DATABASE_URL kết nối bằng role ${role.rolname} (không superuser, không BYPASSRLS)`,
      role: role.rolname,
      isSuperuser: role.rolsuper,
      isBypassRls: role.rolbypassrls,
    };
  } catch (error) {
    return {
      ok: false,
      message: `Lỗi kiểm tra role DB: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    await prisma.$disconnect();
  }
}
