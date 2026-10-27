"use client";

import { useState } from "react";
import { getApiErrorMessage, notifyApp, setAdminUserLock } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton, RowActions } from "@/components/ui/RowActions";
import { Select, TextInput } from "@/components/ui/form";
import { usePagedList } from "@/lib/use-paged-list";
import type { AdminUser } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã bị khóa",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  LOCKED: "danger",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Quản trị viên SaaS",
  LANDLORD: "Chủ nhà trọ",
  RENTER: "Người thuê phòng",
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-purple-50 text-purple-700 border-purple-200",
  LANDLORD: "bg-blue-50 text-blue-700 border-blue-200",
  RENTER: "bg-slate-50 text-slate-700 border-slate-200",
};

export default function AdminUsersPage() {
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<AdminUser | null>(null);

  const list = usePagedList<AdminUser>("/admin/users", {
    page,
    pageSize: 20,
    status: status || undefined,
    role: role || undefined,
    search: search || undefined,
  });

  const listError = list.error ? getApiErrorMessage(list.error) : null;
  const totalPages = list.pagination
    ? Math.max(1, Math.ceil(list.pagination.total / 20))
    : 1;

  async function toggle(user: AdminUser) {
    setLoading(user.id);
    setError(null);
    try {
      const locking = user.status === "ACTIVE";
      await setAdminUserLock(user.id, locking ? "lock" : "unlock");
      notifyApp({
        tone: "success",
        message: locking ? "Đã khóa tài khoản người dùng" : "Đã mở khóa tài khoản thành công",
      });
      setLockTarget(null);
      await list.mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  function requestToggle(user: AdminUser) {
    if (user.status === "ACTIVE") {
      setLockTarget(user);
      return;
    }
    void toggle(user);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Người dùng Toàn hệ thống"
        description="Kiểm soát danh sách tài khoản, vai trò và phân quyền khóa/mở khóa đăng nhập."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {listError ? <Alert tone="error">{listError}</Alert> : null}

      {/* Bộ lọc và Tìm kiếm */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <TextInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo họ tên hoặc email..."
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả vai trò</option>
              <option value="ADMIN">Quản trị viên SaaS</option>
              <option value="LANDLORD">Chủ nhà trọ</option>
              <option value="RENTER">Người thuê</option>
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
            </Select>
          </div>
        </div>

        {list.pagination && (
          <div className="text-xs font-medium text-slate-500 whitespace-nowrap px-1">
            Tổng cộng: <span className="font-bold text-slate-800">{list.pagination.total}</span> người dùng
          </div>
        )}
      </div>

      {/* Bảng danh sách tài khoản */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Họ Và Tên</th>
                <th className="px-5 py-3.5">Email Đăng Nhập</th>
                <th className="px-5 py-3.5">Vai Trò</th>
                <th className="px-5 py-3.5">Trạng Thái</th>
                <th className="px-5 py-3.5 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {list.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Đang tải danh sách người dùng...</span>
                    </div>
                  </td>
                </tr>
              ) : list.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    <p className="font-medium text-slate-700">Không có người dùng phù hợp</p>
                    <p className="mt-1 text-xs text-slate-400">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.</p>
                  </td>
                </tr>
              ) : (
                list.rows.map((user) => {
                  const isLocked = user.status === "LOCKED";
                  const isAdmin = user.role === "ADMIN";
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{user.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {user.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ROLE_BADGE[user.role] ?? "bg-slate-100 text-slate-800"}`}>
                          {ROLE_LABEL[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={STATUS_TONE[user.status]} dot>
                          {STATUS_LABEL[user.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isAdmin ? (
                          <RowActions>
                            <ActionButton
                              tone={isLocked ? "primary" : "danger"}
                              disabled={loading === user.id}
                              onClick={() => requestToggle(user)}
                            >
                              {isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                            </ActionButton>
                          </RowActions>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Quản trị cấp cao</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {list.pagination && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Trang <span className="font-semibold text-slate-700">{list.pagination.page}</span> / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={lockTarget !== null}
        title="Khóa tài khoản"
        tone="danger"
        confirmLabel="Khóa tài khoản"
        loading={loading === lockTarget?.id}
        onCancel={() => setLockTarget(null)}
        onConfirm={() => lockTarget && void toggle(lockTarget)}
        message={
          <p>
            Tài khoản <span className="font-semibold">{lockTarget?.fullName}</span> (
            {lockTarget?.email}) sẽ bị khóa và không thể đăng nhập cho đến khi được mở khóa.
          </p>
        }
      />
    </div>
  );
}
