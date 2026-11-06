"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { getApiErrorMessage, syncPayment } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FullScreenSpinner } from "@/components/guards";
import { LogoMark } from "@/components/Logo";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getHomePathForRole } from "@/lib/navigation";
import { useAuth } from "@/lib/auth-context";
import type { PaymentListItem, PaymentStatus } from "@/lib/types";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Đang chờ thanh toán",
  PAID: "Thanh toán thành công",
  CANCELLED: "Giao dịch đã hủy",
  FAILED: "Thanh toán thất bại",
};

const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "neutral",
  FAILED: "danger",
};

function ResultCard({
  payment,
  checking,
  onRecheck,
  homeHref,
}: {
  payment: PaymentListItem;
  checking: boolean;
  onRecheck: () => void;
  homeHref: string;
}) {
  const isPaid = payment.status === "PAID";
  const isPending = payment.status === "PENDING";

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="flex flex-col items-center text-center">
        <span
          className={
            isPaid
              ? "flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success-text"
              : isPending
                ? "flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning-text"
                : "flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger-text"
          }
        >
          <Icon name={isPaid ? "success" : isPending ? "clock" : "alert"} className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-ink">{STATUS_LABEL[payment.status]}</h1>
        <p className="mt-1 text-sm text-muted">
          {isPaid
            ? "Hệ thống đã ghi nhận thanh toán cho hóa đơn của bạn."
            : isPending
              ? "Giao dịch chưa được xác nhận. Nếu bạn đã thanh toán, hãy bấm kiểm tra lại."
              : "Giao dịch không thành công hoặc đã bị hủy."}
        </p>

        <div className="mt-4 w-full space-y-1.5 rounded-lg border border-border bg-canvas px-4 py-3 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Số tiền</span>
            <span className="font-semibold text-ink">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Mã giao dịch</span>
            <span className="text-ink">{payment.orderCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Thời điểm</span>
            <span className="text-ink">{formatDateTime(payment.createdAt)}</span>
          </div>
          {payment.paidAt && (
            <div className="flex justify-between">
              <span className="text-muted">Đã trả</span>
              <span className="text-ink">{formatDateTime(payment.paidAt)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted">Trạng thái</span>
            <Badge tone={STATUS_TONE[payment.status]} dot>
              {STATUS_LABEL[payment.status]}
            </Badge>
          </div>
        </div>

        <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row">
          {isPending && (
            <Button fullWidth variant="secondary" onClick={onRecheck} loading={checking}>
              <Icon name="refresh" className="h-4 w-4" />
              Kiểm tra lại
            </Button>
          )}
          <Link
            href={homeHref}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PaymentResult() {
  const params = useSearchParams();
  const paymentId = params.get("paymentId");
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const homeHref = user ? getHomePathForRole(user.role) : "/login";
  const missingId = !paymentId;

  // Trạng thái cuối cùng do webhook payOS quyết định; trang này chỉ đọc lại từ API.
  const { data: payment, isLoading, error: loadError, mutate } = useSWR(
    paymentId ? ["payment-result", paymentId] : null,
    async () => {
      const synced = await syncPayment(paymentId as string);
      return synced;
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const loading = isLoading && !payment;
  const resolvedError =
    error ??
    (missingId
      ? "Thiếu mã giao dịch. Vui lòng mở lại từ trang hóa đơn."
      : loadError
        ? getApiErrorMessage(loadError)
        : null);

  const recheck = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      await mutate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setChecking(false);
    }
  }, [mutate]);

  const content = useMemo(() => {
    if (loading) return <FullScreenSpinner />;
    if (resolvedError || !payment) {
      return (
        <div className="w-full max-w-md space-y-4">
          <Alert tone="error">{resolvedError ?? "Không tìm thấy giao dịch thanh toán."}</Alert>
          <Link
            href={homeHref}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-container"
          >
            Về trang chủ
          </Link>
        </div>
      );
    }
    return (
      <ResultCard payment={payment} checking={checking} onRecheck={() => void recheck()} homeHref={homeHref} />
    );
  }, [loading, resolvedError, payment, checking, homeHref, recheck]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-16 items-center px-6">
        <Link href={homeHref} className="flex items-center gap-2">
          <LogoMark className="h-8 w-8 text-primary" />
          <span className="font-bold text-ink">Quản lý nhà trọ</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">{content}</main>
      <footer className="px-6 pb-6 text-center text-xs text-muted">
        Kết quả thanh toán được xác nhận tự động từ cổng payOS.
      </footer>
    </div>
  );
}
