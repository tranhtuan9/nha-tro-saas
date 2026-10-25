import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-semibold text-ink">404</h1>
      <p className="text-sm text-muted">Trang không tồn tại</p>
      <Link href="/">
        <Button>Về trang chủ</Button>
      </Link>
    </div>
  );
}
