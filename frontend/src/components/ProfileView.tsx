"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field, PasswordInput, TextInput } from "@/components/ui/form";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/navigation";
import type { ApiEnvelope, User } from "@/lib/types";

interface FormErrors {
  [field: string]: string;
}

export function ProfileView() {
  const { user, tenantName, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [nationalId, setNationalId] = useState(user?.nationalId ?? "");
  const [profileErrors, setProfileErrors] = useState<FormErrors>({});
  const [profileServerMessage, setProfileServerMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<FormErrors>({});
  const [passwordServerMessage, setPasswordServerMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const [prevUser, setPrevUser] = useState(user);
  if (user && user !== prevUser) {
    setPrevUser(user);
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
    setNationalId(user.nationalId ?? "");
  }

  if (!user) return null;

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileServerMessage(null);
    setProfileError(null);

    const errors: FormErrors = {};
    if (fullName.trim().length < 2) errors.fullName = "Họ và tên phải từ 2 ký tự trở lên";
    if (phone.trim() && phone.replace(/\D/g, "").length < 9) {
      errors.phone = "Số điện thoại không hợp lệ";
    }
    if (nationalId.trim() && nationalId.trim().length < 9) {
      errors.nationalId = "Số CCCD không hợp lệ";
    }
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingProfile(true);
    try {
      await api.put<ApiEnvelope<User>>("/auth/me", {
        fullName: fullName.trim(),
        phone: phone.trim(),
        nationalId: nationalId.trim(),
      });
      await refreshUser();
      setProfileServerMessage("Đã lưu thay đổi thông tin hồ sơ.");
    } catch (error) {
      setProfileError(getApiErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordServerMessage(null);
    setPasswordError(null);

    const errors: FormErrors = {};
    if (!currentPassword) errors.currentPassword = "Mật khẩu hiện tại không được để trống";
    if (newPassword.length < 6) errors.newPassword = "Mật khẩu mới phải từ 6 ký tự trở lên";
    if (confirmPassword !== newPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setChangingPassword(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setPasswordServerMessage("Đổi mật khẩu thành công. Vui lòng sử dụng mật khẩu mới ở lần đăng nhập sau.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(getApiErrorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        breadcrumb="Tài khoản / Thông tin Cá nhân"
        title="Hồ sơ cá nhân"
        description="Cập nhật thông tin cá nhân và mật khẩu đăng nhập."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Thông tin cá nhân</h2>

          <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4">
            <Field label="Họ và tên" htmlFor="profile-full-name" required error={profileErrors.fullName}>
              <TextInput
                id="profile-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                error={Boolean(profileErrors.fullName)}
              />
            </Field>
            <Field label="Email" htmlFor="profile-email" hint="Email đăng nhập, không thể thay đổi.">
              <TextInput id="profile-email" value={user.email} disabled readOnly />
            </Field>
            <Field label="Số điện thoại" htmlFor="profile-phone" error={profileErrors.phone}>
              <TextInput
                id="profile-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0901 234 567"
                inputMode="tel"
                autoComplete="tel"
                error={Boolean(profileErrors.phone)}
              />
            </Field>
            <Field label="Số CCCD" htmlFor="profile-national-id" error={profileErrors.nationalId}>
              <TextInput
                id="profile-national-id"
                value={nationalId}
                onChange={(event) => setNationalId(event.target.value)}
                placeholder="012345678901"
                error={Boolean(profileErrors.nationalId)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vai trò" htmlFor="profile-role">
                <TextInput id="profile-role" value={ROLE_LABELS[user.role]} disabled readOnly />
              </Field>
              <Field label="Đơn vị" htmlFor="profile-tenant">
                <TextInput id="profile-tenant" value={tenantName ?? "—"} disabled readOnly />
              </Field>
            </div>

            {profileError && <Alert tone="error">{profileError}</Alert>}
            {profileServerMessage && <Alert tone="success">{profileServerMessage}</Alert>}

            <div className="pt-2">
              <Button type="submit" loading={savingProfile}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </section>

        <section className="h-fit rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Đổi mật khẩu</h2>
          <p className="mt-1 text-sm text-muted">Mật khẩu mới phải từ 6 ký tự trở lên.</p>

          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
            <Field
              label="Mật khẩu hiện tại"
              htmlFor="password-current"
              required
              error={passwordErrors.currentPassword}
            >
              <PasswordInput
                id="password-current"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                autoComplete="current-password"
                error={Boolean(passwordErrors.currentPassword)}
              />
            </Field>
            <Field
              label="Mật khẩu mới"
              htmlFor="password-new"
              required
              error={passwordErrors.newPassword}
            >
              <PasswordInput
                id="password-new"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Nhập mật khẩu mới"
                autoComplete="new-password"
                error={Boolean(passwordErrors.newPassword)}
              />
            </Field>
            <Field
              label="Xác nhận mật khẩu mới"
              htmlFor="password-confirm"
              required
              error={passwordErrors.confirmPassword}
            >
              <PasswordInput
                id="password-confirm"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                error={Boolean(passwordErrors.confirmPassword)}
              />
            </Field>

            {passwordError && <Alert tone="error">{passwordError}</Alert>}
            {passwordServerMessage && <Alert tone="success">{passwordServerMessage}</Alert>}

            <Button type="submit" loading={changingPassword}>
              Đổi mật khẩu
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
