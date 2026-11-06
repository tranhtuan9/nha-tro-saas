import useSWR from "swr";
import { apiFetcher } from "./api";
import type { PagePagination, PageResult } from "./types";

export type ListQuery = Record<string, string | number | boolean | null | undefined>;

/**
 * Key SWR ổn định cho danh sách phân trang: [path, queryString sắp xếp theo tên].
 * Dùng lại được với mutate toàn cục (useSWRConfig) để refresh sau khi tạo/sửa.
 */
export function listKey(path: string, query: ListQuery = {}): [string, string] {
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const qs = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return [path, qs ? `${path}?${qs}` : path];
}

export interface PagedList<T> {
  rows: T[];
  pagination: PagePagination | null;
  isLoading: boolean;
  error: unknown;
  mutate: () => Promise<unknown>;
}

/**
 * Endpoint danh sách của backend có hai dạng body:
 * - Phẳng: { data: [...], pagination } (properties, rooms, invoices, payments...).
 * - Bọc: { data: { data: [...], pagination } } (admin...).
 * Chuẩn hoá cả hai về PageResult để trang gọi không cần quan tâm.
 */
function normalizePageResult<T>(body: unknown): PageResult<T> | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const inner = record.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const nested = inner as Record<string, unknown>;
    if (Array.isArray(nested.data)) {
      return { data: nested.data as T[], pagination: nested.pagination as PagePagination };
    }
  }
  if (Array.isArray(inner)) {
    return { data: inner as T[], pagination: record.pagination as PagePagination };
  }
  return null;
}

export function usePagedList<T>(path: string, query: ListQuery = {}): PagedList<T> {
  const key = listKey(path, query);
  const url = key[1];
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => apiFetcher<unknown>(url),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const page = normalizePageResult<T>(data);

  return {
    rows: page?.data ?? [],
    pagination: page?.pagination ?? null,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}
