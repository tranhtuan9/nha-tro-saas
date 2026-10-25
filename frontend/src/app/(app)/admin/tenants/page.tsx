"use client";

import { useState } from "react";
import { getAdminPlans, getAdminTenant, getApiErrorMessage, notifyApp, setAdminTenantStatus, updateAdminTenantPlan } from "@/lib/api";
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
      <PageHeader title="Nhà trọ & Gói dịch vụ" description="Quản lý nhà trọ, trạng thái và gói dịch vụ." />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {listError ? <Alert tone="error">{listError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <TextInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm kiếm nhà trọ"
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="SUSPENDED">Tạm ngưng</option>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-container">
              <th className="px-4 py-2 text-left font-semibold text-ink">Tên</th>
              <th className="px-4 py-2 text-left font-semibold text-ink">Gói</th>
              <th className="px-4 py-2 text-left font-semibold text-ink">Trạng thái</th>
              <th className="px-4 py-2 text-left font-semibold text-ink">Hết hạn</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Đang tải...</td></tr>
            ) : list.rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Không có dữ liệu</td></tr>
            ) : (
              list.rows.map((tenant) => (
                <tr key={tenant.id} className="border-b border-border">
                  <td className="px-4 py-2 text-ink">{tenant.name}</td>
                  <td className="px-4 py-2 text-muted">{tenant.plan?.name ?? "-"}</td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONE[tenant.status]} dot>{STATUS_LABEL[tenant.status]}</Badge></td>
                  <td className="px-4 py-2 text-muted">{tenant.subscriptionEnd ? formatDate(tenant.subscriptionEnd) : "-"}</td>
                  <td className="px-4 py-2 text-right"><Button variant="secondary" onClick={() => void openDetail(tenant.id)}>Chi tiết</Button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {list.pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Trang {list.pagination.page}/{totalPages} · {list.pagination.total} nhà trọ
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

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Chi tiết nhà trọ">
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Tên</span><span className="text-ink">{selected.name}</span></div>
              <div className="flex justify-between"><span className="text-muted">Trạng thái</span><Badge tone={STATUS_TONE[selected.status]} dot>{STATUS_LABEL[selected.status]}</Badge></div>
              <div className="flex justify-between"><span className="text-muted">Gói</span><span className="text-ink">{selected.plan?.name ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Hết hạn</span><span className="text-ink">{selected.subscriptionEnd ? formatDate(selected.subscriptionEnd) : "-"}</span></div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">Đổi gói & gia hạn</p>
              <Select value={planForm.planId} onChange={(e) => setPlanForm({ ...planForm, planId: e.target.value })}>
                <option value="">Chọn gói</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                    {plan.price ? ` - ${formatCurrency(plan.price)}` : ""}
                  </option>
                ))}
              </Select>
              <TextInput value={planForm.extendDays} onChange={(e) => setPlanForm({ ...planForm, extendDays: e.target.value })} placeholder="Gia hạn thêm (ngày)" type="number" />
              <TextInput value={planForm.subscriptionEnd} onChange={(e) => setPlanForm({ ...planForm, subscriptionEnd: e.target.value })} placeholder="Hoặc đặt ngày hết hạn" type="date" />
              <Button onClick={() => void changePlan()} loading={loading}>Cập nhật</Button>
            </div>
            <Button variant="secondary" onClick={() => void toggleStatus()} loading={loading}>
              {selected.status === "ACTIVE" ? "Tạm ngưng" : "Kích hoạt"}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
