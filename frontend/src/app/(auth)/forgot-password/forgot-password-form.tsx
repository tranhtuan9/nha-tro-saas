"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/form";
import { api, getApiErrorMessage } from "@/lib/api";
import { isValidEmail } from "@/lib/format";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const nextErrors: Record<string, string> = {};
    if (!isValidEmail(email)) nextErrors.email = "Email không đúng định dạng";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Không thể xử lý yêu cầu. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quên mật khẩu?</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Nhập địa chỉ email đăng ký để nhận liên kết xác thực đặt lại mật khẩu mới.
        </p>
      </div>

      {submitted ? (
        <div className="space-y-6">
          <Alert tone="success">
            Nếu email <span className="font-semibold text-slate-900">{email}</span> tồn tại trong hệ thống,
            liên kết khôi phục đã được gửi. Vui lòng kiểm tra hộp thư (kể cả mục spam).
          </Alert>
          <Link href="/login" className="block">
            <Button variant="secondary" fullWidth>
              Quay lại đăng nhập
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {serverError && <Alert tone="error" className="mb-6">{serverError}</Alert>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Địa chỉ Email" htmlFor="forgot-email" required error={errors.email}>
              <TextInput
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ten@vi-du.vn"
                autoComplete="email"
                error={Boolean(errors.email)}
              />
            </Field>

            <div className="pt-2">
              <Button type="submit" fullWidth loading={submitting}>
                Gửi liên kết khôi phục
              </Button>
            </div>
          </form>
        </>
      )}

      <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
        Bạn đã nhớ ra mật khẩu?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          Quay lại Đăng nhập
        </Link>
      </div>
    </div>
  );
}
