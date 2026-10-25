"use client";

import { useState } from "react";
import { getApiErrorMessage, notifyApp, setAdminUserLock } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, TextInput } from "@/components/ui/form";
import { usePagedList } from "@/lib/use-paged-list";
import type { AdminUser } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khóa",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  LOCKED: "danger",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Quản trị viên",
  LANDLORD: "Chủ nhà trọ",
  RENTER: "Người thuê",
};

export default function AdminUsersPage() {
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function toggle(id: string, currentStatus: string) {
    setLoading(id);
    setError(null);
    try {
      await setAdminUserLock(id, currentStatus === "ACTIVE" ? "lock" : "unlock");
      notifyApp({
        tone: "success",
        message: currentStatus === "ACTIVE" ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản",
      });
      await list.mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Người dùng" description="Quản lý tài khoản người dùng trên toàn hệ thống." />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {listError ? <Alert tone="error">{listError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <TextInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm kiếm"
          className="max-w-xs"
        />
        <Select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả vai trò</option>
          <option value="ADMIN">Quản trị viên</option>
          <option value="LANDLORD">Chủ nhà trọ</option>
          <option value="RENTER">Người thuê</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="LOCKED">Đã khóa</option>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-container">
              <th className="px-4 py-2 text-left font-semibold text-ink">Họ tên</th>
              <th className="px-4 py-2 text-left font-semibold text-ink">Email</th>
              <th className="px-4 py-2 text-left font-semibold text-ink">Vai trò</th>
              <th className="px-4 py-2 text-left font-semibold text-ink">Trạng thái</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Đang tải...</td></tr>
            ) : list.rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Không có dữ liệu</td></tr>
            ) : (
              list.rows.map((user) => (
                <tr key={user.id} className="border-b border-border">
                  <td className="px-4 py-2 text-ink">{user.fullName}</td>
                  <td className="px-4 py-2 text-muted">{user.email}</td>
                  <td className="px-4 py-2 text-muted">{ROLE_LABEL[user.role] ?? user.role}</td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONE[user.status]} dot>{STATUS_LABEL[user.status]}</Badge></td>
                  <td className="px-4 py-2 text-right">
                    {user.role !== "ADMIN" && (
                      <Button variant="secondary" loading={loading === user.id} onClick={() => void toggle(user.id, user.status)}>
                        {user.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {list.pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Trang {list.pagination.page}/{totalPages} · {list.pagination.total} người dùng
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
              Trước
            </Button>
            <Button variant="secondary" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
