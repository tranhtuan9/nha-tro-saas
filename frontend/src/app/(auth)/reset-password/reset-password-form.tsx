"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, PasswordInput } from "@/components/ui/form";
import { api, getApiErrorMessage } from "@/lib/api";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const nextErrors: Record<string, string> = {};
    if (newPassword.length < 6) nextErrors.newPassword = "Mật khẩu mới phải từ 6 ký tự trở lên";
    if (confirmPassword !== newPassword) nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !token) return;

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setDone(true);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Không thể đặt lại mật khẩu. Vui lòng thử lại."));
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-bold text-ink">Đặt lại mật khẩu</h1>
        <Alert tone="error" className="mt-4">
          Liên kết đặt lại mật khẩu không hợp lệ hoặc đã thiếu mã token. Vui lòng yêu cầu lại liên
          kết mới.
        </Alert>
        <Link href="/forgot-password" className="mt-4 block">
          <Button variant="secondary" fullWidth>
            Yêu cầu lại liên kết
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
      <h1 className="text-2xl font-bold text-ink">Đặt lại mật khẩu</h1>
      <p className="mt-1 text-sm text-muted">Chọn mật khẩu mới cho tài khoản của bạn.</p>

      {done ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">
            Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.
          </Alert>
          <Link href="/login">
            <Button fullWidth>Đến trang đăng nhập</Button>
          </Link>
        </div>
      ) : (
        <>
          {serverError && <Alert tone="error" className="mt-4">{serverError}</Alert>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field
              label="Mật khẩu mới"
              htmlFor="reset-password"
              required
              error={errors.newPassword}
            >
              <PasswordInput
                id="reset-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                autoComplete="new-password"
                error={Boolean(errors.newPassword)}
              />
            </Field>
            <Field
              label="Xác nhận mật khẩu mới"
              htmlFor="reset-confirm"
              required
              error={errors.confirmPassword}
            >
              <PasswordInput
                id="reset-confirm"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                error={Boolean(errors.confirmPassword)}
              />
            </Field>
            <Button type="submit" fullWidth loading={submitting}>
              Đặt lại mật khẩu
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
