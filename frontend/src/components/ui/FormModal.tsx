"use client";

import { useId } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function FormModal({
  open,
  onClose,
  title,
  description,
  size = "md",
  submitLabel = "Lưu",
  submitting = false,
  error = null,
  onSubmit,
  children,
  footerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  submitLabel?: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  footerExtra?: React.ReactNode;
}) {
  const formId = useId();

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          {footerExtra}
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" form={formId} loading={submitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {children}
      </form>
    </Modal>
  );
}
