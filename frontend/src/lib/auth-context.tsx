"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, ApiError } from "./api";
import {
  clearSession,
  getSessionServerSnapshot,
  getSessionSnapshot,
  setSession,
  subscribeSession,
} from "./auth-storage";
import { isSubscriptionExpired } from "./format";
import type { ApiEnvelope, AuthResponse, MePayload, PlanInfo, User } from "./types";

export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  tenantName: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  tenantName: string | null;
  /** Hạn dùng hiện có (từ login hoặc /auth/me khi backend bổ sung); null nếu chưa biết. */
  subscriptionEnd: string | null;
  /** Luật 12: Tenant hết hạn — vẫn xem được, chặn tạo mới. */
  subscriptionExpired: boolean;
  /** false khi hết hạn — toàn bộ nút tạo mới phải kiểm tra giá trị này. */
  canCreate: boolean;
  /** Gói dịch vụ (chỉ có khi backend trả kèm tenant.plan trong /auth/me). */
  plan: PlanInfo | null;
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
}

const ME_KEY = "/auth/me";

async function meFetcher(path: string): Promise<ApiEnvelope<MePayload>> {
  const res = await api.get<ApiEnvelope<MePayload>>(path);
  return res.data;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();

  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getSessionServerSnapshot,
  );
  const token = session.token;
  const tenantName = session.tenantName;

  const { data, mutate } = useSWR<ApiEnvelope<MePayload>>(token ? ME_KEY : null, meFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: (error) => !(error instanceof ApiError && error.status === 401),
  });

  const user = token ? (data?.data ?? null) : null;
  const meTenant = data?.data.tenant ?? null;
  const subscriptionEnd = meTenant?.subscriptionEnd ?? session.subscriptionEnd;
  const plan = meTenant?.plan ?? null;
  const subscriptionExpired = isSubscriptionExpired(subscriptionEnd);
  const canCreate = !subscriptionExpired;

  useEffect(() => {
    function onSessionExpired() {
      void globalMutate(ME_KEY, undefined, { revalidate: false });
      if (!window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        router.replace(`/login?next=${next}`);
      }
    }
    window.addEventListener("app:session-expired", onSessionExpired);
    return () => window.removeEventListener("app:session-expired", onSessionExpired);
  }, [globalMutate, router]);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const res = await api.post<ApiEnvelope<AuthResponse>>("/auth/login", { email, password });
      const payload = res.data.data;
      setSession(payload.token, rememberMe, payload.tenant?.name ?? null, payload.tenant?.subscriptionEnd ?? null);
      await globalMutate<ApiEnvelope<MePayload>>(
        ME_KEY,
        { data: { ...payload.user, tenant: payload.tenant ?? undefined } },
        { revalidate: false },
      );
      return payload.user;
    },
    [globalMutate],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await api.post<ApiEnvelope<AuthResponse>>("/auth/register", {
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || undefined,
        password: input.password,
        tenantName: input.tenantName.trim(),
      });
      const payload = res.data.data;
      setSession(payload.token, false, payload.tenant?.name ?? null, payload.tenant?.subscriptionEnd ?? null);
      await globalMutate<ApiEnvelope<MePayload>>(
        ME_KEY,
        { data: { ...payload.user, tenant: payload.tenant ?? undefined } },
        { revalidate: false },
      );
      return payload.user;
    },
    [globalMutate],
  );

  const logout = useCallback(() => {
    clearSession();
    void globalMutate(ME_KEY, undefined, { revalidate: false });
    router.replace("/login");
  }, [globalMutate, router]);

  const refreshUser = useCallback(async () => {
    const result = await mutate();
    return result?.data ?? null;
  }, [mutate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      tenantName,
      subscriptionEnd,
      subscriptionExpired,
      canCreate,
      plan,
      login,
      register,
      logout,
      refreshUser,
    }),
    [
      token,
      user,
      tenantName,
      subscriptionEnd,
      subscriptionExpired,
      canCreate,
      plan,
      login,
      register,
      logout,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được sử dụng bên trong AuthProvider");
  return context;
}
