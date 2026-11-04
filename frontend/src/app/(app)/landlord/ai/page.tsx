"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  aiChat,
  confirmProposal,
  getApiErrorMessage,
  rejectProposal,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton, RowActions } from "@/components/ui/RowActions";
import { formatBillingMonth, formatCurrency, formatDateTime } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { AiChatReply, AiHistoryEntry, AiProposal, AiProposalStatus, InvoicePreview } from "@/lib/types";

const PROPOSAL_STATUS_LABEL: Record<AiProposalStatus, string> = {
  PROPOSED: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã từ chối",
  EXECUTED: "Đã thực hiện",
  FAILED: "Thất bại",
};

const PROPOSAL_STATUS_TONE: Record<AiProposalStatus, BadgeTone> = {
  PROPOSED: "warning",
  CONFIRMED: "info",
  REJECTED: "neutral",
  EXECUTED: "success",
  FAILED: "danger",
};

const ACTION_LABEL: Record<string, string> = {
  createInvoice: "Lập hóa đơn",
  createContract: "Tạo hợp đồng",
  setRoomStatus: "Đổi trạng thái phòng",
};

interface ChatMessage {
  role: AiHistoryEntry["role"];
  text: string;
}

const QUICK_PROMPTS = [
  "Tạo hóa đơn tháng này cho phòng đang thuê",
  "Danh sách hóa đơn chưa thu",
  "Doanh thu tháng này thế nào?",
  "Phòng nào đang còn trống?",
];

function isInvoicePreview(preview: unknown): preview is InvoicePreview {
  return (
    typeof preview === "object" &&
    preview !== null &&
    "totalAmount" in preview &&
    "lineItems" in preview
  );
}

function ProposalPreview({ proposal }: { proposal: AiProposal }) {
  if (isInvoicePreview(proposal.preview)) {
    const preview = proposal.preview;
    return (
      <div className="space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            Phòng {preview.room.roomCode} · Kỳ {formatBillingMonth(preview.billingMonth)}
          </span>
          <span>Hạn {preview.dueDate.split("-").reverse().join("/")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Tiền phòng</span>
          <span className="text-ink">{formatCurrency(preview.rentAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Tiền điện</span>
          <span className="text-ink">{formatCurrency(preview.electricityAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Tiền nước</span>
          <span className="text-ink">{formatCurrency(preview.waterAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Dịch vụ</span>
          <span className="text-ink">{formatCurrency(preview.serviceAmount)}</span>
        </div>
        {preview.lineItems.map((item) => (
          <div key={item.serviceId} className="flex justify-between pl-4 text-xs text-muted">
            <span>
              {item.serviceName} ({item.quantity} {item.unit})
            </span>
            <span>{formatCurrency(item.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-2 font-semibold text-ink">
          <span>Tổng cộng</span>
          <span>{formatCurrency(preview.totalAmount)}</span>
        </div>
      </div>
    );
  }

  if (proposal.preview && typeof proposal.preview === "object") {
    return (
      <dl className="space-y-1 text-sm">
        {Object.entries(proposal.preview as Record<string, unknown>).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <dt className="text-muted">{key}</dt>
            <dd className="text-right text-ink">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <p className="text-sm text-muted">Không có thông tin xem trước.</p>;
}

export default function AiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProposal, setActiveProposal] = useState<AiProposal | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AiProposal | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [proposalPage, setProposalPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const proposalsList = usePagedList<AiProposal>("/ai/proposals", {
    page: proposalPage,
    pageSize: 10,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeProposal]);

  const history = useMemo<AiHistoryEntry[]>(
    () => messages.map((message) => ({ role: message.role, text: message.text })),
    [messages],
  );

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    try {
      const result: AiChatReply = await aiChat(message, history);
      setMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
      if (result.proposal) {
        setProposalError(null);
        setActiveProposal(result.proposal);
        await proposalsList.mutate();
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function confirmActive() {
    if (!activeProposal) return;
    setProposalBusy(true);
    setProposalError(null);
    try {
      await confirmProposal(activeProposal.id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Đề xuất đã được xác nhận và thực hiện." },
      ]);
      setActiveProposal(null);
      await proposalsList.mutate();
    } catch (err) {
      setProposalError(getApiErrorMessage(err));
    } finally {
      setProposalBusy(false);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejectBusy(true);
    setRejectError(null);
    try {
      await rejectProposal(rejectTarget.id);
      if (activeProposal?.id === rejectTarget.id) setActiveProposal(null);
      setRejectTarget(null);
      await proposalsList.mutate();
    } catch (err) {
      setRejectError(getApiErrorMessage(err));
    } finally {
      setRejectBusy(false);
    }
  }

  function isExpired(proposal: AiProposal): boolean {
    return proposal.status === "PROPOSED" && new Date(proposal.expiresAt).getTime() < now;
  }

  const proposalPagination = proposalsList.pagination;
  const proposalTotalPages = proposalPagination
    ? Math.max(1, Math.ceil(proposalPagination.total / proposalPagination.pageSize))
    : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Tiện ích / Trợ lý Thông minh"
        title="Trợ lý AI"
        description="Tra cứu thông tin và tạo hóa đơn bằng ngôn ngữ tự nhiên. Mọi thao tác ghi dữ liệu đều cần bạn xác nhận."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <div className="flex h-[34rem] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon name="smart_toy" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Hội thoại</p>
                <p className="text-xs text-muted">Hỏi đáp và thao tác bằng ngôn ngữ tự nhiên</p>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary ring-8 ring-primary-soft/40">
                    <Icon name="smart_toy" className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-ink">Trợ lý AI</p>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">
                    Hỏi về tình trạng phòng, hóa đơn chưa thu hoặc yêu cầu lập hóa đơn. Thao tác ghi dữ
                    liệu sẽ được xem trước và chờ bạn xác nhận.
                  </p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-white"
                        : "max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-container px-3.5 py-2 text-sm text-ink"
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {activeProposal && (
                <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Icon name="receipt_long" className="h-4 w-4 text-primary" />
                    Đề xuất: {ACTION_LABEL[activeProposal.actionType] ?? activeProposal.actionType}
                  </div>
                  <div className="mt-2.5">
                    <ProposalPreview proposal={activeProposal} />
                  </div>
                  {proposalError && (
                    <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                      {proposalError}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRejectError(null);
                        setRejectTarget(activeProposal);
                      }}
                      disabled={proposalBusy}
                    >
                      Hủy
                    </Button>
                    <Button
                      onClick={() => void confirmActive()}
                      loading={proposalBusy}
                      disabled={isExpired(activeProposal)}
                    >
                      <Icon name="check" className="h-4 w-4" />
                      Xác nhận
                    </Button>
                  </div>
                  {isExpired(activeProposal) && (
                    <p className="mt-2 text-xs text-muted">Đề xuất đã hết hạn, vui lòng yêu cầu lại.</p>
                  )}
                </div>
              )}
            </div>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 border-t border-border bg-surface-container/30 px-4 py-3">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    disabled={sending}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form
              className="flex items-end gap-2 border-t border-border bg-surface-container/30 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="Nhập câu hỏi hoặc yêu cầu..."
                className="max-h-32 min-h-10 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <Button type="submit" loading={sending} disabled={!input.trim()}>
                <Icon name="chevron_right" className="h-4 w-4" />
                Gửi
              </Button>
            </form>
            <div className="border-t border-border/50 bg-surface-container/20 px-3 py-1.5 text-center">
              <p className="text-[11px] text-muted">
                Trợ lý AI tự động · Thông tin chỉ mang tính tham khảo · Luôn kiểm tra kỹ trước khi xác nhận thao tác.
              </p>
            </div>
          </div>
          {error && (
            <div className="mt-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">Đề xuất gần đây</h2>
              {proposalPagination && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {proposalPagination.total}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Chỉ thực hiện sau khi bạn xác nhận và được ghi vào nhật ký hệ thống.
            </p>
          </div>

          {proposalsList.isLoading ? (
            <ul className="divide-y divide-border">
              {[0, 1, 2].map((row) => (
                <li key={row} className="space-y-2.5 px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-surface-container" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-surface-container" />
                  </div>
                  <div className="h-3 w-36 animate-pulse rounded bg-surface-container" />
                </li>
              ))}
            </ul>
          ) : proposalsList.error ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted">Không tải được đề xuất.</p>
              <Button variant="secondary" className="mt-3" onClick={() => void proposalsList.mutate()}>
                <Icon name="refresh" className="h-4 w-4" />
                Thử lại
              </Button>
            </div>
          ) : proposalsList.rows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-muted">
                <Icon name="smart_toy" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">Chưa có đề xuất nào</p>
              <p className="mt-1 text-sm text-muted">
                Đề xuất ghi dữ liệu của Trợ lý AI sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {proposalsList.rows.map((proposal) => (
                <li key={proposal.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {ACTION_LABEL[proposal.actionType] ?? proposal.actionType}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{formatDateTime(proposal.createdAt)}</p>
                    </div>
                    {isExpired(proposal) ? (
                      <Badge tone="neutral" dot>
                        Hết hạn
                      </Badge>
                    ) : (
                      <Badge tone={PROPOSAL_STATUS_TONE[proposal.status]} dot>
                        {PROPOSAL_STATUS_LABEL[proposal.status]}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <RowActions>
                      <ActionButton onClick={() => setActiveProposal(proposal)}>Xem</ActionButton>
                      {proposal.status === "PROPOSED" && !isExpired(proposal) && (
                        <ActionButton
                          tone="danger"
                          onClick={() => {
                            setRejectError(null);
                            setRejectTarget(proposal);
                          }}
                        >
                          Từ chối
                        </ActionButton>
                      )}
                    </RowActions>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {proposalPagination && proposalTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted">
                Trang {proposalPagination.page}/{proposalTotalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setProposalPage((value) => Math.max(1, value - 1))}
                  disabled={proposalPagination.page <= 1}
                  aria-label="Trang trước"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-container hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon name="chevron_left" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setProposalPage((value) => Math.min(proposalTotalPages, value + 1))}
                  disabled={proposalPagination.page >= proposalTotalPages}
                  aria-label="Trang sau"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-container hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon name="chevron_right" className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={rejectTarget !== null}
        title="Từ chối đề xuất"
        tone="danger"
        confirmLabel="Từ chối"
        loading={rejectBusy}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => void confirmReject()}
        message={
          <>
            <p>
              Đề xuất{" "}
              <span className="font-semibold">
                {rejectTarget ? ACTION_LABEL[rejectTarget.actionType] ?? rejectTarget.actionType : ""}
              </span>{" "}
              sẽ bị từ chối và không được thực hiện.
            </p>
            {rejectError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {rejectError}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
