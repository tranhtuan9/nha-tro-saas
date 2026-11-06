"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, PasswordInput, TextInput } from "@/components/ui/form";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api";
import { isValidEmail } from "@/lib/format";
import { getHomePathForRole } from "@/lib/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, token, user } = useAuth();

  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam &&
    nextParam.startsWith("/") &&
    nextParam !== "/" &&
    !nextParam.startsWith("/login") &&
    !nextParam.startsWith("/register") &&
    !nextParam.startsWith("/forgot-password") &&
    !nextParam.startsWith("/reset-password")
      ? nextParam
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token && user) {
      router.replace(nextPath ?? getHomePathForRole(user.role));
    }
  }, [token, user, nextPath, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const nextErrors: Record<string, string> = {};
    if (!isValidEmail(email)) nextErrors.email = "Email không đúng định dạng";
    if (!password) nextErrors.password = "Mật khẩu không được để trống";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const loggedIn = await login(email, password, remember);
      router.replace(nextPath ?? getHomePathForRole(loggedIn.role));
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin."));
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đăng nhập tài khoản</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Truy cập hệ thống quản lý phòng trọ hoặc xem hóa đơn của bạn.
        </p>
      </div>

      {serverError && <Alert tone="error" className="mb-6">{serverError}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Địa chỉ Email" htmlFor="login-email" required error={errors.email}>
          <TextInput
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ten@vi-du.vn"
            autoComplete="email"
            error={Boolean(errors.email)}
          />
        </Field>

        <Field label="Mật khẩu" htmlFor="login-password" required error={errors.password}>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu của bạn"
            autoComplete="current-password"
            error={Boolean(errors.password)}
          />
        </Field>

        <div className="flex items-center justify-between pt-1">
          <Checkbox
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            label="Ghi nhớ đăng nhập"
          />
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <div className="pt-2">
          <Button type="submit" fullWidth loading={submitting}>
            Đăng nhập ngay
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
        Bạn là chủ nhà trọ mới?{" "}
        <Link
          href="/register"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          Đăng ký tài khoản hệ thống
        </Link>
      </div>
    </div>
  );
}
