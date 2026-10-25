"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

export const INPUT_BASE =
  "h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-muted";

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger-text">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  error,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(INPUT_BASE, error ? "border-danger" : "border-border", className)}
      {...rest}
    />
  );
}

export function PasswordInput({
  error,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={cn(
          INPUT_BASE,
          error ? "border-danger" : "border-border",
          "pr-10",
          className,
        )}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted hover:text-ink"
      >
        <Icon name={visible ? "eye_off" : "eye"} className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-2 text-sm text-ink", className)}>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-border text-primary accent-primary"
        {...rest}
      />
      {label}
    </label>
  );
}

export function Select({
  error,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(
          INPUT_BASE,
          "appearance-none pr-9",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevron_down"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

export function Textarea({
  error,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cn(
        INPUT_BASE,
        "h-auto min-h-20 py-2.5 leading-relaxed",
        error ? "border-danger" : "border-border",
        className,
      )}
      {...rest}
    />
  );
}
