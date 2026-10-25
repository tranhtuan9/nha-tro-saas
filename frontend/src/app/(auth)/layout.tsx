import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-active" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10 text-white/15" />
          <div>
            <p className="text-lg font-bold">Quản lý nhà trọ</p>
            <p className="text-xs text-white/70">Nền tảng SaaS đa nhà trọ</p>
          </div>
        </div>
        <div className="relative">
          <p className="max-w-md text-2xl font-semibold leading-snug">
            Quản lý phòng trọ, người thuê và hóa đơn trên cùng một hệ thống.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/80">
            <li>Quản lý nhà trọ, phòng và hợp đồng</li>
            <li>Lập hóa đơn và theo dõi thanh toán</li>
            <li>Nhận phản ánh từ người thuê và trợ lý AI</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/60">
          Dành cho chủ nhà trọ, người thuê và quản trị viên
        </p>
      </div>

      <div className="flex flex-col bg-canvas">
        <header className="flex h-16 items-center px-6 lg:px-10">
          <Link href="/login" className="flex items-center gap-2 lg:hidden">
            <LogoMark className="h-8 w-8 text-primary" />
            <span className="font-bold">Quản lý nhà trọ</span>
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="px-6 pb-6 text-center text-xs text-muted lg:px-10">
          © Quản lý nhà trọ SaaS
        </footer>
      </div>
    </div>
  );
}
