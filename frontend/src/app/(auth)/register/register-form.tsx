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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 mb-2">
          <span>Dùng thử miễn phí</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đăng ký Chủ nhà trọ</h1>
        <p className="mt-1 text-sm text-slate-500">
          Khởi tạo không gian quản lý nhà trọ và bắt đầu vận hành ngay.
        </p>
      </div>

      {serverError && <Alert tone="error" className="mb-6">{serverError}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Họ và tên" htmlFor="reg-fullname" required error={errors.fullName}>
          <TextInput
            id="reg-fullname"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            error={Boolean(errors.fullName)}
          />
        </Field>

        <Field
          label="Tên hệ thống / Chuỗi nhà trọ"
          htmlFor="reg-tenant"
          required
          error={errors.tenantName}
        >
          <TextInput
            id="reg-tenant"
            value={tenantName}
            onChange={(event) => setTenantName(event.target.value)}
            placeholder="VD: Nhà trọ An Khang"
            error={Boolean(errors.tenantName)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Địa chỉ Email" htmlFor="reg-email" required error={errors.email}>
            <TextInput
              id="reg-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ten@vi-du.vn"
              autoComplete="email"
              error={Boolean(errors.email)}
            />
          </Field>

          <Field label="Số điện thoại" htmlFor="reg-phone" error={errors.phone}>
            <TextInput
              id="reg-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0912 345 678"
              autoComplete="tel"
              error={Boolean(errors.phone)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mật khẩu" htmlFor="reg-password" required error={errors.password}>
            <PasswordInput
              id="reg-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              error={Boolean(errors.password)}
            />
          </Field>

          <Field
            label="Xác nhận mật khẩu"
            htmlFor="reg-confirm"
            required
            error={errors.confirmPassword}
          >
            <PasswordInput
              id="reg-confirm"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              error={Boolean(errors.confirmPassword)}
            />
          </Field>
        </div>

        <div className="pt-1">
          <Checkbox
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            label="Tôi đồng ý với quy định vận hành và điều khoản dịch vụ"
          />
          {errors.agreed && <p className="mt-1 text-xs text-danger">{errors.agreed}</p>}
        </div>

        <div className="pt-2">
          <Button type="submit" fullWidth loading={submitting}>
            Tạo tài khoản quản lý
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          Đăng nhập ngay
        </Link>
      </div>
    </div>
  );
}
