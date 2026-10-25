"use client";

import { useMemo, useState } from "react";
import { getApiErrorMessage, getSupportRequest, notifyApp, respondSupportRequest } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, Textarea } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { SupportRequestItem, SupportStatus, SupportType } from "@/lib/types";

const TYPE_LABEL: Record<SupportType, string> = {
  COMPLAINT: "Khiếu nại",
  REPAIR: "Sửa chữa",
  OTHER: "Khác",
};

const STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
};

const STATUS_TONE: Record<SupportStatus, BadgeTone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
};

export default function LandlordFeedbackPage() {
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportRequestItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [response, setResponse] = useState("");
  const [nextStatus, setNextStatus] = useState<SupportStatus>("IN_PROGRESS");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = usePagedList<SupportRequestItem>("/support-requests", {
    page,
    pageSize: 20,
    status: status || undefined,
    type: type || undefined,
  });

  const listError = list.error ? getApiErrorMessage(list.error) : null;
  const totalPages = list.pagination
    ? Math.max(1, Math.ceil(list.pagination.total / 20))
    : 1;

  async function openDetail(id: string) {
    setSelectedId(id);
    setError(null);
    setResponse("");
    setNextStatus("IN_PROGRESS");
    setLoadingDetail(true);
    try {
      const data = await getSupportRequest(id);
      setDetail(data);
      if (data.status === "OPEN") setNextStatus("IN_PROGRESS");
      if (data.status === "IN_PROGRESS") setNextStatus("RESOLVED");
      if (data.status === "RESOLVED") setNextStatus("RESOLVED");
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
      if (nextStatus === "RESOLVED" && !response.trim()) {
        throw new Error("RESPONSE_REQUIRED");
      }
      const updated = await respondSupportRequest(detail.id, {
        status: nextStatus,
        response: response.trim() || undefined,
      });
      setDetail(updated);
      notifyApp({ tone: "success", message: "Đã cập nhật phản ánh" });
      await list.mutate();
    } catch (err) {
      if (err instanceof Error && err.message === "RESPONSE_REQUIRED") {
        setError("Vui lòng nhập nội dung phản hồi khi chuyển trạng thái Đã xử lý");
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rows = useMemo(() => list.rows, [list.rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Phản ánh" description="Xem và xử lý các phản ánh từ người thuê." />

      {error && <Alert tone="error">{error}</Alert>}
      {listError && <Alert tone="error">{listError}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Mới</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="RESOLVED">Đã xử lý</option>
        </Select>
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả loại</option>
          <option value="COMPLAINT">Khiếu nại</option>
          <option value="REPAIR">Sửa chữa</option>
          <option value="OTHER">Khác</option>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Danh sách phản ánh</h2>
          </div>
          {list.isLoading ? (
            <p className="px-4 py-6 text-sm text-muted">Đang tải...</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Không có phản ánh nào.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => void openDetail(item.id)}
                    className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-container"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink">{item.title}</p>
                      <Badge tone={STATUS_TONE[item.status]} dot>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{TYPE_LABEL[item.type]}</span>
                      <span>•</span>
                      <span>{item.renter?.fullName ?? "Người thuê"}</span>
                      <span>•</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.pagination && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted">
                Trang {list.pagination.page}/{totalPages} · {list.pagination.total} phản ánh
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

        <div className="rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Chi tiết & phản hồi</h2>
          </div>
          {!selectedId ? (
            <p className="px-4 py-6 text-sm text-muted">Chọn một phản ánh để xem chi tiết.</p>
          ) : loadingDetail ? (
            <p className="px-4 py-6 text-sm text-muted">Đang tải...</p>
          ) : detail ? (
            <div className="space-y-4 px-4 py-4">
              <div>
                <p className="text-base font-semibold text-ink">{detail.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge tone={STATUS_TONE[detail.status]} dot>
                    {STATUS_LABEL[detail.status]}
                  </Badge>
                  <span>{TYPE_LABEL[detail.type]}</span>
                  <span>•</span>
                  <span>{detail.renter?.fullName ?? "-"}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Nội dung</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{detail.content}</p>
              </div>
              {detail.response && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Phản hồi</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{detail.response}</p>
                  {detail.respondedAt && <p className="mt-1 text-xs text-muted">{formatDateTime(detail.respondedAt)}</p>}
                </div>
              )}
              {detail.status !== "RESOLVED" && (
                <div className="space-y-3">
                  <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as SupportStatus)}>
                    <option value="IN_PROGRESS">Chuyển sang Đang xử lý</option>
                    <option value="RESOLVED">Chuyển sang Đã xử lý</option>
                  </Select>
                  <Textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Nhập nội dung phản hồi (bắt buộc khi Đã xử lý)"
                    rows={4}
                  />
                  <Button onClick={() => void submitResponse()} loading={submitting}>
                    Cập nhật
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
