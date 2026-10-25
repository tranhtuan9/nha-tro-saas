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
    <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
      <h1 className="text-2xl font-bold text-ink">Quên mật khẩu</h1>
      <p className="mt-1 text-sm text-muted">
        Nhập email đã đăng ký, chúng tôi sẽ gửi cho bạn liên kết đặt lại mật khẩu.
      </p>

      {submitted ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">
            Nếu email <span className="font-semibold">{email}</span> tồn tại trong hệ thống, liên
            kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (và thư mục spam).
          </Alert>
          <Link href="/login">
            <Button variant="secondary" fullWidth>
              Quay lại đăng nhập
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {serverError && <Alert tone="error" className="mt-4">{serverError}</Alert>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email" htmlFor="forgot-email" required error={errors.email}>
              <TextInput
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ban@example.com"
                autoComplete="email"
                error={Boolean(errors.email)}
              />
            </Field>
            <Button type="submit" fullWidth loading={submitting}>
              Gửi liên kết đặt lại mật khẩu
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Đã nhớ mật khẩu?{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
