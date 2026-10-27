import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { currentBillingMonth, formatBillingMonth } from "@/lib/format";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  const billingMonth = formatBillingMonth(currentBillingMonth());

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
              <p className="text-xs text-slate-400">Nền tảng quản lý vận hành nhà trọ</p>
            </div>
          </Link>
        </div>

        {/* Center: Operational value fragment */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-blue-400 mb-6">
            <span>Quản lý tập trung</span>
          </div>

          <h2 className="text-3xl font-extrabold leading-snug tracking-tight text-white">
            Mọi việc vận hành nhà trọ. <br />
            Trong một màn hình.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400 max-w-sm">
            Theo dõi phòng, hợp đồng, chỉ số điện nước và phản ánh của người thuê. Dữ liệu được sắp xếp rõ ràng để bạn
            xử lý công việc nhanh mỗi ngày.
          </p>

          {/* Mini operational card */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-800/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
              <div>
                <p className="text-xs font-semibold text-slate-300">Nhà trọ Bình Minh</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Không gian quản lý của bạn</p>
              </div>
              <span className="whitespace-nowrap rounded bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-800/80">
                Đang vận hành
              </span>
            </div>
            <ul className="mt-3 space-y-3">
              <li className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">Phòng 302 · Hợp đồng</p>
                    <p className="text-[11px] text-slate-500">Sắp đến ngày kết thúc</p>
                  </div>
                </div>
                <span className="whitespace-nowrap text-[11px] font-semibold text-amber-400">Sắp hết hạn</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">Phòng 105 · Phản ánh mới</p>
                    <p className="text-[11px] text-slate-500">Đang chờ chủ trọ phản hồi</p>
                  </div>
                </div>
                <span className="whitespace-nowrap text-[11px] font-semibold text-sky-400">Mới</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">Chỉ số điện nước</p>
                    <p className="text-[11px] text-slate-500">Kỳ {billingMonth} đã nhập đủ</p>
                  </div>
                </div>
                <span className="whitespace-nowrap text-[11px] font-semibold text-emerald-400">Hoàn tất</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom trust proof */}
        <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dữ liệu tách biệt theo từng chủ trọ</span>
          </div>
          <span>Vận hành ổn định</span>
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
