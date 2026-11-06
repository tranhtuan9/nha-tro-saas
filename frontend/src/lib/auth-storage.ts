import type { JwtClaims } from "./types";

const TOKEN_KEY = "nha_tro_token";
const TENANT_NAME_KEY = "nha_tro_tenant_name";
const TENANT_END_KEY = "nha_tro_tenant_end";

export interface SessionSnapshot {
  token: string | null;
  tenantName: string | null;
  subscriptionEnd: string | null;
}

const EMPTY_SESSION: SessionSnapshot = { token: null, tenantName: null, subscriptionEnd: null };

let snapshot: SessionSnapshot = EMPTY_SESSION;
const listeners = new Set<() => void>();

function publish(next: SessionSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionSnapshot(): SessionSnapshot {
  return snapshot;
}

export function getSessionServerSnapshot(): SessionSnapshot {
  return EMPTY_SESSION;
}

export function decodeTokenClaims(raw: string): JwtClaims | null {
  try {
    const segment = raw.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    );
    const payload = JSON.parse(json) as Partial<JwtClaims>;
    if (!payload.userId || !payload.role) return null;
    return { userId: payload.userId, role: payload.role, tenantId: payload.tenantId ?? null };
  } catch {
    return null;
  }
}

function removeStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_NAME_KEY);
  localStorage.removeItem(TENANT_END_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TENANT_NAME_KEY);
  sessionStorage.removeItem(TENANT_END_KEY);
}

function readStoredSession(): SessionSnapshot {
  const storedLocal = localStorage.getItem(TOKEN_KEY);
  const storedSession = sessionStorage.getItem(TOKEN_KEY);
  const raw = storedLocal ?? storedSession;
  const store = storedLocal !== null ? localStorage : sessionStorage;
  return {
    token: raw,
    tenantName: store.getItem(TENANT_NAME_KEY),
    subscriptionEnd: store.getItem(TENANT_END_KEY),
  };
}

if (typeof window !== "undefined") {
  publish(readStoredSession());
}

export function setSession(
  raw: string,
  rememberMe: boolean,
  name: string | null,
  subscriptionEnd: string | null,
): void {
  removeStoredSession();
  const store = rememberMe ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, raw);
  if (name) store.setItem(TENANT_NAME_KEY, name);
  if (subscriptionEnd) store.setItem(TENANT_END_KEY, subscriptionEnd);
  publish({ token: raw, tenantName: name, subscriptionEnd });
}

export function clearSession(): void {
  removeStoredSession();
  publish(EMPTY_SESSION);
}

export function getToken(): string | null {
  return snapshot.token;
}
