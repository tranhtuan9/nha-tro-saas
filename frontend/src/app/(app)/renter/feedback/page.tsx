"use client";

import { useState } from "react";
import { createSupportRequest, getApiErrorMessage, notifyApp } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, TextInput, Textarea } from "@/components/ui/form";
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

export default function RenterFeedbackPage() {
  const [type, setType] = useState<SupportType>("REPAIR");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const list = usePagedList<SupportRequestItem>("/support-requests", { page, pageSize: 20 });

  const listError = list.error ? getApiErrorMessage(list.error) : null;
  const totalPages = list.pagination
    ? Math.max(1, Math.ceil(list.pagination.total / 20))
    : 1;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (!title.trim() || !content.trim()) {
        setError("Vui lòng nhập tiêu đề và nội dung");
        setSubmitting(false);
        return;
      }
      await createSupportRequest({ type, title: title.trim(), content: content.trim() });
      notifyApp({ tone: "success", message: "Đã gửi phản ánh" });
      setTitle("");
      setContent("");
      setPage(1);
      await list.mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Người thuê phòng / Gửi phản ánh" title="Gửi phản ánh" description="Gửi sự cố và theo dõi phản hồi từ chủ trọ." />

      {error && <Alert tone="error">{error}</Alert>}
      {listError && <Alert tone="error">{listError}</Alert>}

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Gửi phản ánh mới</h2>
        </div>
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink">Loại</label>
            <Select value={type} onChange={(e) => setType(e.target.value as SupportType)}>
              <option value="COMPLAINT">Khiếu nại</option>
              <option value="REPAIR">Sửa chữa</option>
              <option value="OTHER">Khác</option>
            </Select>

            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium text-ink">Tiêu đề</label>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium text-ink">Nội dung</label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Mô tả chi tiết vấn đề" />
            </div>
          </div>
          <Button onClick={() => void submit()} loading={submitting}>
            Gửi phản ánh
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Phản ánh của tôi</h2>
        </div>
        {list.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Đang tải...</p>
        ) : list.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Bạn chưa gửi phản ánh nào.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.rows.map((item) => {
              const statusKey = item.status;
              const typeKey = item.type;
              return (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink">{item.title}</p>
                    <Badge tone={STATUS_TONE[statusKey]} dot>
                      {STATUS_LABEL[statusKey]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{TYPE_LABEL[typeKey]}</span>
                    <span>•</span>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{item.content}</p>
                  {item.response && (
                    <div className="mt-3 rounded-lg bg-surface-container px-3 py-2">
                      <p className="text-xs font-semibold text-ink">Phản hồi từ chủ nhà</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.response}</p>
                      {item.respondedAt && <p className="mt-1 text-xs text-muted">{formatDateTime(item.respondedAt)}</p>}
                    </div>
                  )}
                </li>
              );
            })}
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
    </div>
  );
}
