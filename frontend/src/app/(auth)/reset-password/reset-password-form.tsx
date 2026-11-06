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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đặt lại mật khẩu</h1>
        <Alert tone="error" className="mt-4">
          Liên kết đặt lại mật khẩu không hợp lệ hoặc thiếu mã xác thực. Vui lòng yêu cầu lại liên kết mới.
        </Alert>
        <div className="mt-6">
          <Link href="/forgot-password" className="block">
            <Button variant="secondary" fullWidth>
              Yêu cầu lại liên kết
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đặt lại mật khẩu mới</h1>
        <p className="mt-1.5 text-sm text-slate-500">Thiết lập mật khẩu mới an toàn cho tài khoản của bạn.</p>
      </div>

      {done ? (
        <div className="space-y-6">
          <Alert tone="success">
            Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
          </Alert>
          <Link href="/login" className="block">
            <Button fullWidth>Đến trang Đăng nhập</Button>
          </Link>
        </div>
      ) : (
        <>
          {serverError && <Alert tone="error" className="mb-6">{serverError}</Alert>}
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="pt-2">
              <Button type="submit" fullWidth loading={submitting}>
                Cập nhật mật khẩu mới
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
