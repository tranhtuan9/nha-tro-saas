"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { getApiErrorMessage, getSupportRequest, notifyApp, respondSupportRequest } from "@/lib/api";
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

interface FeedbackDetailFormProps {
  detail: SupportRequestItem;
  onUpdated: () => Promise<void>;
}

function FeedbackDetailForm({ detail, onUpdated }: FeedbackDetailFormProps) {
  const [response, setResponse] = useState(detail.response ?? "");
  const [nextStatus, setNextStatus] = useState<SupportStatus>(
    detail.status === "OPEN" ? "IN_PROGRESS" : detail.status === "IN_PROGRESS" ? "RESOLVED" : "RESOLVED"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitResponse() {
    setSubmitting(true);
    setError(null);
    try {
      await respondSupportRequest(detail.id, {
        status: nextStatus,
        response: response.trim() || undefined,
      });
      notifyApp({ tone: "success", message: "Đã gửi phản hồi thành công" });
      await onUpdated();
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
      {error && <Alert tone="error">{error}</Alert>}

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
  );
}

export default function LandlordFeedbackPage() {
  const [tab, setTab] = useState<"all" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = usePagedList<SupportRequestItem>("/support-requests", {
    pageSize: 50,
    status: tab === "all" ? undefined : tab,
  });

  const listError = list.error ? getApiErrorMessage(list.error) : null;
  const rows = useMemo(() => list.rows, [list.rows]);

  // Tự suy diễn ID đang chọn: ưu tiên item người dùng click, fallback về item đầu tiên
  const activeId = (selectedId && rows.some((r) => r.id === selectedId))
    ? selectedId
    : rows[0]?.id ?? null;

  const {
    data: detail,
    error: detailError,
    isLoading: loadingDetail,
    mutate: reloadDetail,
  } = useSWR(activeId ? ["support-request-detail", activeId] : null, () =>
    getSupportRequest(activeId!)
  );

  const detailErrorMessage = detailError ? getApiErrorMessage(detailError) : null;

  async function handleUpdated() {
    await Promise.all([list.mutate(), reloadDetail()]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phản ánh & Hỗ trợ"
        description="Tiếp nhận, xử lý và phản hồi các yêu cầu sửa chữa, hỗ trợ từ khách thuê phòng."
      />

      {detailErrorMessage && <Alert tone="error">{detailErrorMessage}</Alert>}
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
              const isSelected = activeId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
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
            {!activeId || !detail ? (
              <div className="py-16 text-center text-slate-400">
                {loadingDetail
                  ? "Đang tải chi tiết..."
                  : "Chọn một phản ánh ở cột bên trái để xem và gửi phản hồi."}
              </div>
            ) : (
              <FeedbackDetailForm
                key={detail.id}
                detail={detail}
                onUpdated={handleUpdated}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
