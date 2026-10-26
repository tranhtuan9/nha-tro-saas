"use client";

import { useState } from "react";
import {
  getAdminPlans,
  getAdminTenant,
  getApiErrorMessage,
  notifyApp,
  setAdminTenantStatus,
  updateAdminTenantPlan,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, TextInput } from "@/components/ui/form";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { AdminTenant, PlanInfo } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  SUSPENDED: "Tạm ngưng",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
};

export default function AdminTenantsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminTenant | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [planForm, setPlanForm] = useState({ planId: "", extendDays: "", subscriptionEnd: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = usePagedList<AdminTenant>("/admin/tenants", {
    page,
    pageSize: 20,
    status: status || undefined,
    search: search || undefined,
  });

  const listError = list.error ? getApiErrorMessage(list.error) : null;
  const totalPages = list.pagination
    ? Math.max(1, Math.ceil(list.pagination.total / 20))
    : 1;

  async function loadPlans() {
    try {
      const data = await getAdminPlans();
      setPlans(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function openDetail(id: string) {
    setError(null);
    try {
      const data = await getAdminTenant(id);
      setSelected(data);
      setPlanForm({ planId: data.planId ?? "", extendDays: "", subscriptionEnd: "" });
      if (plans.length === 0) await loadPlans();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function toggleStatus() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await setAdminTenantStatus(selected.id, selected.status === "ACTIVE" ? "suspend" : "activate");
      notifyApp({
        tone: "success",
        message: selected.status === "ACTIVE" ? "Đã tạm ngưng nhà trọ" : "Đã kích hoạt nhà trọ",
      });
      setSelected(null);
      await list.mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function changePlan() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await updateAdminTenantPlan(selected.id, {
        planId: planForm.planId,
        extendDays: planForm.extendDays ? Number(planForm.extendDays) : undefined,
        subscriptionEnd: planForm.subscriptionEnd || undefined,
      });
      notifyApp({ tone: "success", message: "Đã cập nhật gói dịch vụ" });
      setSelected(null);
      await list.mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Hệ thống Nhà trọ (Tenants)"
        description="Giám sát trạng thái hoạt động, thời hạn thuê bao và phân bổ gói dịch vụ cho từng chủ trọ."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {listError ? <Alert tone="error">{listError}</Alert> : null}

      {/* Metrics / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <TextInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm kiếm theo tên nhà trọ..."
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="SUSPENDED">Tạm ngưng</option>
            </Select>
          </div>
        </div>

        {list.pagination && (
          <div className="text-xs font-medium text-slate-500 whitespace-nowrap px-1">
            Tổng cộng: <span className="font-bold text-slate-800">{list.pagination.total}</span> hệ thống
          </div>
        )}
      </div>

      {/* Modern High-Agency Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Tên Hệ Thống Nhà Trọ</th>
                <th className="px-5 py-3.5">Gói Dịch Vụ</th>
                <th className="px-5 py-3.5">Trạng Thái</th>
                <th className="px-5 py-3.5">Ngày Hết Hạn</th>
                <th className="px-5 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {list.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Đang tải danh sách nhà trọ...</span>
                    </div>
                  </td>
                </tr>
              ) : list.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    <p className="font-medium text-slate-700">Không tìm thấy nhà trọ phù hợp</p>
                    <p className="mt-1 text-xs text-slate-400">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</p>
                  </td>
                </tr>
              ) : (
                list.rows.map((tenant) => {
                  const isSuspended = tenant.status === "SUSPENDED";
                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{tenant.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {tenant.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {tenant.plan?.name ?? "Mặc định"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={STATUS_TONE[tenant.status]} dot>
                          {STATUS_LABEL[tenant.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <span className={tenant.subscriptionEnd ? "text-slate-700 font-medium" : "text-slate-400"}>
                          {tenant.subscriptionEnd ? formatDate(tenant.subscriptionEnd) : "Vô thời hạn"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="secondary"
                          className="h-8 px-3 text-xs"
                          onClick={() => void openDetail(tenant.id)}
                        >
                          Cấu hình gói & Trạng thái
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
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

      {/* Modal chi tiết & cấu hình Tenant */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Quản trị Gói & Trạng thái Nhà trọ"
      >
        {selected && (
          <div className="space-y-6 pt-2">
            {/* Thẻ tóm tắt thông tin hiện tại */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tên hệ thống</span>
                <span className="font-semibold text-slate-900">{selected.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Trạng thái hiện tại</span>
                <Badge tone={STATUS_TONE[selected.status]} dot>
                  {STATUS_LABEL[selected.status]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Gói thuê bao</span>
                <span className="font-medium text-slate-800">{selected.plan?.name ?? "Gói mặc định"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Hạn sử dụng</span>
                <span className="font-medium text-slate-800">
                  {selected.subscriptionEnd ? formatDate(selected.subscriptionEnd) : "Không giới hạn"}
                </span>
              </div>
            </div>

            {/* Khung đổi gói & gia hạn */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Nâng cấp gói & Điều chỉnh thời hạn
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Chọn gói SaaS</label>
                  <Select
                    value={planForm.planId}
                    onChange={(e) => setPlanForm({ ...planForm, planId: e.target.value })}
                  >
                    <option value="">-- Chọn gói dịch vụ --</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} {plan.price ? `(${formatCurrency(plan.price)}/tháng)` : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gia hạn thêm (Số ngày)</label>
                    <TextInput
                      value={planForm.extendDays}
                      onChange={(e) => setPlanForm({ ...planForm, extendDays: e.target.value })}
                      placeholder="VD: 30"
                      type="number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Hoặc chỉ định ngày hết hạn</label>
                    <TextInput
                      value={planForm.subscriptionEnd}
                      onChange={(e) => setPlanForm({ ...planForm, subscriptionEnd: e.target.value })}
                      type="date"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button onClick={() => void changePlan()} loading={loading} fullWidth>
                    Lưu thay đổi gói & hạn dùng
                  </Button>
                </div>
              </div>
            </div>

            {/* Khung chuyển đổi trạng thái (Tạm ngưng / Kích hoạt) */}
            <div className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selected.status === "ACTIVE" ? "Tạm ngưng hoạt động" : "Kích hoạt lại nhà trọ"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.status === "ACTIVE"
                    ? "Tạm khóa quyền tạo dữ liệu mới của chủ trọ và người thuê."
                    : "Khôi phục đầy đủ quyền truy cập cho hệ thống nhà trọ này."}
                </p>
              </div>
              <Button
                variant={selected.status === "ACTIVE" ? "danger" : "secondary"}
                onClick={() => void toggleStatus()}
                loading={loading}
              >
                {selected.status === "ACTIVE" ? "Tạm ngưng ngay" : "Kích hoạt ngay"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
