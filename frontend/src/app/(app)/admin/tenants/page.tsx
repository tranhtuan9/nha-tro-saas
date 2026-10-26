"use client";

import { useEffect, useState } from "react";
import {
  createAdminPlan,
  deactivateAdminPlan,
  getAdminPlans,
  getAdminTenant,
  getApiErrorMessage,
  notifyApp,
  setAdminTenantStatus,
  updateAdminPlan,
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
  ACTIVE: "Hoạt động",
  SUSPENDED: "Tạm ngưng",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
};

export default function AdminTenantsPage() {
  const [activeTab, setActiveTab] = useState<"tenants" | "plans">("tenants");

  // State cho Tab Tenants
  const [status, setStatus] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState<AdminTenant | null>(null);
  const [planForm, setPlanForm] = useState({ planId: "", extendDays: "", subscriptionEnd: "" });

  // State cho Tab Gói dịch vụ SaaS
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanInfo | null>(null);
  const [planData, setPlanData] = useState({
    name: "",
    maxProperties: "1",
    maxRooms: "20",
    price: "199000",
    durationDays: "30",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = usePagedList<AdminTenant>("/admin/tenants", {
    page,
    pageSize: 20,
    status: status || undefined,
    search: search || undefined,
  });

  const listError = list.error ? getApiErrorMessage(list.error) : null;
  const totalPages = list.pagination ? Math.max(1, Math.ceil(list.pagination.total / 20)) : 1;

  async function loadPlans() {
    setLoadingPlans(true);
    try {
      const data = await getAdminPlans();
      setPlans(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  // Tính toán số liệu thống kê KPI từ list.rows
  const totalTenantsCount = list.pagination?.total ?? list.rows.length;
  const activeCount = list.rows.filter((t) => t.status === "ACTIVE").length;
  const suspendedCount = list.rows.filter((t) => t.status === "SUSPENDED").length;
  const expiringSoonCount = list.rows.filter((t) => {
    if (!t.subscriptionEnd) return false;
    const daysLeft = (new Date(t.subscriptionEnd).getTime() - Date.now()) / (1000 * 3600 * 24);
    return daysLeft >= 0 && daysLeft <= 7;
  }).length;

  async function openTenantDetail(id: string) {
    setError(null);
    try {
      const data = await getAdminTenant(id);
      setSelectedTenant(data);
      setPlanForm({ planId: data.planId ?? "", extendDays: "", subscriptionEnd: "" });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function toggleTenantStatus(tenant: AdminTenant) {
    setLoading(true);
    setError(null);
    try {
      await setAdminTenantStatus(tenant.id, tenant.status === "ACTIVE" ? "suspend" : "activate");
      notifyApp({
        tone: "success",
        message: tenant.status === "ACTIVE" ? "Đã tạm ngưng hệ thống nhà trọ" : "Đã kích hoạt lại nhà trọ",
      });
      if (selectedTenant) setSelectedTenant(null);
      await list.mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function changeTenantPlan() {
    if (!selectedTenant) return;
    setLoading(true);
    setError(null);
    try {
      await updateAdminTenantPlan(selectedTenant.id, {
        planId: planForm.planId,
        extendDays: planForm.extendDays ? Number(planForm.extendDays) : undefined,
        subscriptionEnd: planForm.subscriptionEnd || undefined,
      });
      notifyApp({ tone: "success", message: "Đã cập nhật gói dịch vụ thành công" });
      setSelectedTenant(null);
      await list.mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function openCreatePlanModal() {
    setEditingPlan(null);
    setPlanData({
      name: "",
      maxProperties: "1",
      maxRooms: "20",
      price: "199000",
      durationDays: "30",
    });
    setPlanModalOpen(true);
  }

  function openEditPlanModal(plan: PlanInfo) {
    setEditingPlan(plan);
    setPlanData({
      name: plan.name,
      maxProperties: String(plan.maxProperties),
      maxRooms: String(plan.maxRooms),
      price: plan.price ? String(Math.round(Number(plan.price))) : "0",
      durationDays: String(plan.durationDays ?? 30),
    });
    setPlanModalOpen(true);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: planData.name.trim(),
        maxProperties: Number(planData.maxProperties),
        maxRooms: Number(planData.maxRooms),
        price: Number(planData.price),
        durationDays: Number(planData.durationDays),
      };

      if (editingPlan) {
        await updateAdminPlan(editingPlan.id, payload);
        notifyApp({ tone: "success", message: "Đã cập nhật gói dịch vụ SaaS" });
      } else {
        await createAdminPlan(payload);
        notifyApp({ tone: "success", message: "Đã tạo gói dịch vụ SaaS mới" });
      }
      setPlanModalOpen(false);
      await loadPlans();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivatePlan(plan: PlanInfo) {
    if (!confirm(`Bạn có chắc chắn muốn ẩn/ngừng kích hoạt gói "${plan.name}" không?`)) return;
    setLoading(true);
    setError(null);
    try {
      await deactivateAdminPlan(plan.id);
      notifyApp({ tone: "success", message: "Đã ngừng kích hoạt gói dịch vụ" });
      await loadPlans();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Lọc theo gói ở phía client nếu có chọn
  const filteredTenantRows = planFilter
    ? list.rows.filter((t) => t.planId === planFilter || (planFilter === "none" && !t.planId))
    : list.rows;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs text-slate-400 mb-1">Trang chủ / Tenant & gói dịch vụ</nav>
          <PageHeader
            title="Quản lý Tenant và gói dịch vụ"
            description="Quản lý hệ thống nhà trọ khách hàng và cấu hình các gói thuê bao SaaS."
          />
        </div>
        {activeTab === "plans" && (
          <Button onClick={openCreatePlanModal} className="h-9 px-4 text-sm font-semibold">
            + Thêm gói
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {listError && <Alert tone="error">{listError}</Alert>}

      {/* Tabs Chuyển đổi giữa "Tenant" và "Gói dịch vụ SaaS" chuẩn theo bản vẽ */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("tenants")}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "tenants"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Tenant
          </button>
          <button
            onClick={() => setActiveTab("plans")}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "plans"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            Gói dịch vụ SaaS
          </button>
        </nav>
      </div>

      {/* TAB 1: TENANT MANAGEMENT */}
      {activeTab === "tenants" && (
        <div className="space-y-6">
          {/* 4 Thẻ KPI Bento chuẩn theo bản thiết kế */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Tổng số Tenant</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalTenantsCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Đang hoạt động</p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Sắp hết hạn</p>
              <p className="mt-2 text-3xl font-extrabold text-amber-500">{expiringSoonCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Tạm ngưng</p>
              <p className="mt-2 text-3xl font-extrabold text-rose-500">{suspendedCount}</p>
            </div>
          </div>

          {/* Thanh lọc & tìm kiếm */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-full sm:w-80">
              <TextInput
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo tên Tenant..."
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="SUSPENDED">Tạm ngưng</option>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
              >
                <option value="">Gói</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Bảng danh sách Tenant */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                    <th className="px-5 py-3.5">Tên Tenant</th>
                    <th className="px-5 py-3.5">Gói</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5">Hết hạn</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {list.isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                        Đang tải danh sách Tenant...
                      </td>
                    </tr>
                  ) : filteredTenantRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    filteredTenantRows.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-900">{tenant.name}</td>
                        <td className="px-5 py-4 text-slate-600">{tenant.plan?.name ?? "Cơ bản"}</td>
                        <td className="px-5 py-4">
                          <Badge tone={STATUS_TONE[tenant.status]} dot>
                            {STATUS_LABEL[tenant.status]}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {tenant.subscriptionEnd ? formatDate(tenant.subscriptionEnd) : "-"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              onClick={() => void openTenantDetail(tenant.id)}
                              className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                            >
                              Chi tiết
                            </button>
                            <button
                              onClick={() => void toggleTenantStatus(tenant)}
                              className={`text-xs font-semibold transition-colors ${
                                tenant.status === "ACTIVE"
                                  ? "text-rose-600 hover:text-rose-700"
                                  : "text-blue-600 hover:text-blue-700"
                              }`}
                            >
                              {tenant.status === "ACTIVE" ? "Tạm ngưng" : "Kích hoạt"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {list.pagination && totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Trang {list.pagination.page} / {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    onClick={() => setPage((v) => Math.max(1, v - 1))}
                    disabled={page <= 1}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                    disabled={page >= totalPages}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GÓI DỊCH VỤ SAAS (chuẩn theo màn hình ảnh 1) */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                    <th className="px-5 py-3.5">Tên gói</th>
                    <th className="px-5 py-3.5">Số nhà trọ tối đa</th>
                    <th className="px-5 py-3.5">Số phòng tối đa</th>
                    <th className="px-5 py-3.5">Giá</th>
                    <th className="px-5 py-3.5">Thời hạn (ngày)</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingPlans ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        Đang tải danh sách gói dịch vụ SaaS...
                      </td>
                    </tr>
                  ) : plans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        Chưa có gói dịch vụ nào. Hãy nhấn "+ Thêm gói" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    plans.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {p.name}
                          {p.isActive === false && (
                            <span className="ml-2 text-xs text-rose-500 font-normal">(Đã ẩn)</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-700">{p.maxProperties}</td>
                        <td className="px-5 py-4 text-slate-700">{p.maxRooms}</td>
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {p.price ? formatCurrency(p.price) : "0 đ"}
                        </td>
                        <td className="px-5 py-4 text-slate-700">{p.durationDays ?? 30}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              onClick={() => openEditPlanModal(p)}
                              className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => void handleDeactivatePlan(p)}
                              className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              Ẩn gói
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chi tiết & Đổi gói cho Tenant */}
      <Modal
        open={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
        title="Chi tiết hệ thống nhà trọ (Tenant)"
      >
        {selectedTenant && (
          <div className="space-y-5 pt-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Tên hệ thống:</span>
                <span className="font-semibold text-slate-900">{selectedTenant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trạng thái:</span>
                <Badge tone={STATUS_TONE[selectedTenant.status]} dot>
                  {STATUS_LABEL[selectedTenant.status]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gói hiện tại:</span>
                <span className="font-medium text-slate-800">{selectedTenant.plan?.name ?? "Cơ bản"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời hạn:</span>
                <span className="font-medium text-slate-800">
                  {selectedTenant.subscriptionEnd ? formatDate(selectedTenant.subscriptionEnd) : "Vô thời hạn"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Đổi gói & Gia hạn thuê bao SaaS
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Chọn gói SaaS</label>
                  <Select
                    value={planForm.planId}
                    onChange={(e) => setPlanForm({ ...planForm, planId: e.target.value })}
                  >
                    <option value="">-- Chọn gói --</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} {plan.price ? `(${formatCurrency(plan.price)}/tháng)` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gia hạn thêm (ngày)</label>
                    <TextInput
                      type="number"
                      placeholder="VD: 30"
                      value={planForm.extendDays}
                      onChange={(e) => setPlanForm({ ...planForm, extendDays: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Hoặc đặt ngày hết hạn</label>
                    <TextInput
                      type="date"
                      value={planForm.subscriptionEnd}
                      onChange={(e) => setPlanForm({ ...planForm, subscriptionEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button fullWidth onClick={() => void changeTenantPlan()} loading={loading}>
                    Lưu cập nhật gói
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Thêm / Sửa Gói Dịch Vụ SaaS */}
      <Modal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={editingPlan ? "Chỉnh sửa gói dịch vụ SaaS" : "Thêm gói dịch vụ SaaS mới"}
      >
        <form onSubmit={handleSavePlan} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên gói dịch vụ</label>
            <TextInput
              required
              placeholder="VD: Nâng cao, Doanh nghiệp"
              value={planData.name}
              onChange={(e) => setPlanData({ ...planData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Số nhà trọ tối đa</label>
              <TextInput
                type="number"
                required
                min="0"
                value={planData.maxProperties}
                onChange={(e) => setPlanData({ ...planData, maxProperties: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Số phòng tối đa</label>
              <TextInput
                type="number"
                required
                min="0"
                value={planData.maxRooms}
                onChange={(e) => setPlanData({ ...planData, maxRooms: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Giá gói (VNĐ)</label>
              <TextInput
                type="number"
                required
                min="0"
                value={planData.price}
                onChange={(e) => setPlanData({ ...planData, price: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Thời hạn (ngày)</label>
              <TextInput
                type="number"
                required
                min="1"
                value={planData.durationDays}
                onChange={(e) => setPlanData({ ...planData, durationDays: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" fullWidth loading={loading}>
              {editingPlan ? "Lưu thay đổi" : "Tạo gói dịch vụ"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
