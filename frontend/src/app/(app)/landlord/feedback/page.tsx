"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage, getSupportRequest, notifyApp, respondSupportRequest } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, Textarea } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { SupportRequestItem, SupportStatus } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Đang chờ",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
};

export default function LandlordFeedbackPage() {
  const [tab, setTab] = useState<"all" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportRequestItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [response, setResponse] = useState("");
  const [nextStatus, setNextStatus] = useState<SupportStatus>("IN_PROGRESS");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = usePagedList<SupportRequestItem>("/support-requests", {
    pageSize: 50,
    status: tab === "all" ? undefined : tab,
  });

  const listError = list.error ? getApiErrorMessage(list.error) : null;
  const rows = useMemo(() => list.rows, [list.rows]);

  // Tự động chọn item đầu tiên nếu chưa chọn item nào hoặc đổi tab
  useEffect(() => {
    if (rows.length > 0 && (!selectedId || !rows.some((r) => r.id === selectedId))) {
      void openDetail(rows[0].id);
    } else if (rows.length === 0) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [rows]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setError(null);
    setResponse("");
    setLoadingDetail(true);
    try {
      const data = await getSupportRequest(id);
      setDetail(data);
      if (data.status === "OPEN") setNextStatus("IN_PROGRESS");
      else if (data.status === "IN_PROGRESS") setNextStatus("RESOLVED");
      else setNextStatus("RESOLVED");
      if (data.response) setResponse(data.response);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  }

  async function submitResponse() {
    if (!detail) return;
    setSubmitting(true);
    setError(null);
    try {
      await respondSupportRequest(detail.id, {
        status: nextStatus,
        response: response.trim() || undefined,
      });
      notifyApp({ tone: "success", message: "Đã gửi phản hồi thành công" });
      await list.mutate();
      const updated = await getSupportRequest(detail.id);
      setDetail(updated);
    } catch (err) {
      if (err instanceof Error && err.message === "RESPONSE_REQUIRED") {
        setError("Vui lòng nhập nội dung phản hồi khi chuyển trạng thái Đã giải quyết");
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Trang chủ / Phản ánh"
        title="Tiếp nhận và phản hồi phản ánh"
        description="Xử lý các kiến nghị, phản ánh hư hỏng cơ sở vật chất từ khách thuê."
      />

      {error && <Alert tone="error">{error}</Alert>}
      {listError && <Alert tone="error">{listError}</Alert>}

      {/* Tabs Phân loại phản ánh theo bản thiết kế */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          {[
            { id: "all", label: "Tất cả" },
            { id: "OPEN", label: "Đang chờ" },
            { id: "IN_PROGRESS", label: "Đang xử lý" },
            { id: "RESOLVED", label: "Đã giải quyết" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id as typeof tab);
              }}
              className={`py-2.5 px-1 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Bố cục 2 cột Split-Screen: Trái là danh sách thẻ phản ánh, Phải là khung xử lý chi tiết */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Cột trái (5 cột): Danh sách thẻ phản ánh */}
        <div className="lg:col-span-5 space-y-3">
          {list.isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
              Đang tải danh sách phản ánh...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              Không có phản ánh nào trong mục này.
            </div>
          ) : (
            rows.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => void openDetail(item.id)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/20 shadow-sm ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                    <Badge tone={STATUS_TONE[item.status]} dot>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {item.renter?.fullName ?? "Khách"}
                      {item.room ? ` · P.${item.room.roomCode}` : ""}
                    </span>
                    <span>{formatDateTime(item.createdAt).split(" ")[0]}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cột phải (7 cột): Chi tiết phản ánh & Form phản hồi */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {!selectedId || !detail ? (
              <div className="py-16 text-center text-slate-400">
                Chọn một phản ánh ở cột bên trái để xem và gửi phản hồi.
              </div>
            ) : loadingDetail ? (
              <div className="py-16 text-center text-slate-400">Đang tải chi tiết...</div>
            ) : (
              <div className="space-y-6">
                {/* Header chi tiết */}
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{detail.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Phản ánh · {detail.renter?.fullName ?? "Khách thuê"}
                    {detail.room ? ` · Phòng ${detail.room.roomCode}` : ""} · {formatDateTime(detail.createdAt)}
                  </p>
                </div>

                {/* Khung nội dung phản ánh của người thuê */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Nội dung phản ánh của người thuê
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {detail.content}
                  </div>
                </div>

                {/* Trạng thái xử lý */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Trạng thái
                  </label>
                  <div className="w-full sm:w-64">
                    <Select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as SupportStatus)}
                    >
                      <option value="OPEN">Đang chờ</option>
                      <option value="IN_PROGRESS">Đang xử lý</option>
                      <option value="RESOLVED">Đã giải quyết</option>
                    </Select>
                  </div>
                </div>

                {/* Khung nội dung phản hồi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nội dung phản hồi
                  </label>
                  <Textarea
                    rows={4}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Nhập nội dung phản hồi tới khách thuê phòng..."
                  />
                </div>

                {/* Nút hành động Hủy / Gửi phản hồi */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    variant="secondary"
                    className="h-10 px-5 text-sm"
                    onClick={() => {
                      setResponse(detail.response ?? "");
                      setNextStatus(detail.status);
                    }}
                    disabled={submitting}
                  >
                    Hủy
                  </Button>
                  <Button
                    className="h-10 px-6 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => void submitResponse()}
                    loading={submitting}
                  >
                    Gửi phản hồi
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
