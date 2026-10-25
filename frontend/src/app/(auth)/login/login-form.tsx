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
  const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;

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
      setServerError(getApiErrorMessage(error, "Đăng nhập thất bại. Vui lòng thử lại."));
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
      <h1 className="text-2xl font-bold text-ink">Đăng nhập</h1>
      <p className="mt-1 text-sm text-muted">Đăng nhập để quản lý nhà trọ của bạn</p>

      {serverError && <Alert tone="error" className="mt-4">{serverError}</Alert>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Email" htmlFor="login-email" required error={errors.email}>
          <TextInput
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
            autoComplete="email"
            error={Boolean(errors.email)}
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="login-password" required error={errors.password}>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            error={Boolean(errors.password)}
          />
        </Field>

        <div className="flex items-center justify-between">
          <Checkbox
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            label="Ghi nhớ đăng nhập"
          />
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <Button type="submit" fullWidth loading={submitting}>
          Đăng nhập
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:text-primary-hover"
        >
          Đăng ký làm chủ nhà trọ
        </Link>
      </p>
    </div>
  );
}
