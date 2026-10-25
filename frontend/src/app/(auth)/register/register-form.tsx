"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, PasswordInput, TextInput } from "@/components/ui/form";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api";
import { isValidEmail } from "@/lib/format";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const nextErrors: Record<string, string> = {};
    if (fullName.trim().length < 2) nextErrors.fullName = "Họ và tên phải từ 2 ký tự trở lên";
    if (!isValidEmail(email)) nextErrors.email = "Email không đúng định dạng";
    if (phone.trim() && phone.replace(/\D/g, "").length < 9) {
      nextErrors.phone = "Số điện thoại không hợp lệ";
    }
    if (tenantName.trim().length < 2) {
      nextErrors.tenantName = "Tên hệ thống nhà trọ phải từ 2 ký tự trở lên";
    }
    if (password.length < 6) nextErrors.password = "Mật khẩu phải từ 6 ký tự trở lên";
    if (confirmPassword !== password) nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
    if (!agreed) nextErrors.agreed = "Bạn cần đồng ý với điều khoản sử dụng";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        fullName,
        email,
        phone: phone.trim() || undefined,
        password,
        tenantName,
      });
      router.replace("/landlord/overview");
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Đăng ký thất bại. Vui lòng thử lại."));
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
      <h1 className="text-2xl font-bold text-ink">Đăng ký chủ nhà trọ</h1>
      <p className="mt-1 text-sm text-muted">
        Tạo tài khoản và hệ thống nhà trọ của riêng bạn để bắt đầu quản lý.
      </p>

      {serverError && <Alert tone="error" className="mt-4">{serverError}</Alert>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Họ và tên" htmlFor="register-full-name" required error={errors.fullName}>
          <TextInput
            id="register-full-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            error={Boolean(errors.fullName)}
          />
        </Field>
        <Field label="Email" htmlFor="register-email" required error={errors.email}>
          <TextInput
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
            autoComplete="email"
            error={Boolean(errors.email)}
          />
        </Field>
        <Field
          label="Số điện thoại"
          htmlFor="register-phone"
          error={errors.phone}
          hint="Không bắt buộc."
        >
          <TextInput
            id="register-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0901 234 567"
            inputMode="tel"
            autoComplete="tel"
            error={Boolean(errors.phone)}
          />
        </Field>
        <Field
          label="Tên hệ thống nhà trọ"
          htmlFor="register-tenant"
          required
          error={errors.tenantName}
          hint="Tên hiển thị trên hệ thống, có thể đổi sau."
        >
          <TextInput
            id="register-tenant"
            value={tenantName}
            onChange={(event) => setTenantName(event.target.value)}
            placeholder="Nhà trọ Bình Minh"
            error={Boolean(errors.tenantName)}
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="register-password" required error={errors.password}>
          <PasswordInput
            id="register-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
            error={Boolean(errors.password)}
          />
        </Field>
        <Field
          label="Xác nhận mật khẩu"
          htmlFor="register-confirm"
          required
          error={errors.confirmPassword}
        >
          <PasswordInput
            id="register-confirm"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
            error={Boolean(errors.confirmPassword)}
          />
        </Field>

        <div>
          <Checkbox
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            label="Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật"
          />
          {errors.agreed && (
            <p className="mt-1.5 text-xs font-medium text-danger-text">{errors.agreed}</p>
          )}
        </div>

        <Button type="submit" fullWidth loading={submitting}>
          Đăng ký
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
