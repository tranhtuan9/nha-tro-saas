import { Icon } from "@/components/icons";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-border bg-surface p-10 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="construction" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-ink">Trang đang được phát triển</h2>
        <p className="mt-1 text-sm text-muted">
          Chức năng này sẽ sớm được cập nhật trong các phiên bản tiếp theo.
        </p>
      </div>
    </div>
  );
}
