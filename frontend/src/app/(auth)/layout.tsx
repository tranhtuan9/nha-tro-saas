import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-12 bg-white selection:bg-blue-100 selection:text-blue-900">
      {/* Left Panel: High-agency editorial showcase (col-span-5) */}
      <div className="relative hidden lg:col-span-5 lg:flex lg:flex-col lg:justify-between border-r border-slate-200/80 bg-slate-900 p-12 text-white overflow-hidden">
        {/* Subtle architectural background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

        {/* Top brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <LogoMark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-white">Quản lý nhà trọ</p>
              <p className="text-xs text-slate-400">Nền tảng Cloud SaaS Multi-tenant</p>
            </div>
          </Link>
        </div>

        {/* Center: Live Product Value Fragment (Taste Skill pattern: Real artifact instead of generic claims) */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-blue-400 mb-6">
            <span>Đối soát tức thì</span>
          </div>

          <h2 className="text-3xl font-extrabold leading-snug tracking-tight text-white">
            Vận hành minh bạch. <br />
            Thu tiền tự động qua VietQR.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400 max-w-sm">
            Tự động chốt số điện nước, sinh hóa đơn đa kênh và gạch nợ tự động ngay khi người thuê chuyển khoản.
          </p>

          {/* Mini Real-data Card Simulation */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-800/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-700/60">
              <span className="font-semibold text-slate-300">Nhà trọ Sunshine · Phòng 301</span>
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-800/80">
                Đã thanh toán
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400">Hóa đơn kỳ T10/2026</p>
                <p className="text-sm font-bold text-white mt-0.5">3.850.000 đ</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400">Cổng thanh toán</p>
                <p className="text-xs font-semibold text-blue-400 mt-0.5">VietQR payOS</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Security / Trust Proof */}
        <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PostgreSQL Row-Level Security cô lập dữ liệu</span>
          </div>
          <span>Bảo mật 100%</span>
        </div>
      </div>

      {/* Right Panel: Clean, Focused Auth Forms (col-span-7) */}
      <div className="lg:col-span-7 flex flex-col justify-between bg-[#fafbfc] min-h-screen">
        <header className="flex h-16 items-center justify-between px-6 sm:px-10 lg:px-12 border-b border-slate-200/60 lg:border-none">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <LogoMark className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-900">Quản lý nhà trọ</span>
          </Link>
          <div className="ml-auto">
            <Link
              href="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 transition-colors"
            >
              ← Về trang chủ
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>

        <footer className="px-6 pb-6 text-center text-xs text-slate-400">
          © 2026 Quản lý nhà trọ · Nền tảng quản lý vận hành SaaS
        </footer>
      </div>
    </div>
  );
}
