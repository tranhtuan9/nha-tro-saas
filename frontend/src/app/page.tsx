import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Quản lý nhà trọ - Nền tảng quản lý vận hành nhà trọ thông minh",
  description:
    "Phần mềm quản lý phòng trọ, căn hộ dịch vụ đa chi nhánh: tự động lập hóa đơn, đối soát chỉ số điện nước, cổng thanh toán trực tuyến payOS và trợ lý AI.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 group">
            <Logo className="h-8 w-auto text-blue-600 transition-transform group-hover:scale-105" />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:translate-y-px transition-all"
            >
              Bắt đầu miễn phí
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Proposition */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-semibold text-blue-700 mb-6">
                <span>Nền tảng Cloud SaaS chuyên sâu</span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                Vận hành nhà trọ chuẩn xác, không còn nhầm lẫn sổ sách.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-600 max-w-2xl">
                Quản lý tập trung mọi cơ sở phòng trọ, chốt chỉ số điện nước minh bạch, xuất hóa đơn tức thì kèm mã QR payOS và nhận hỗ trợ từ Trợ lý AI.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/register"
                  className="rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.99] transition-all"
                >
                  Dùng thử miễn phí cho chủ trọ
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Dành cho người thuê
                </Link>
              </div>
              <div className="mt-10 flex items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Dữ liệu cô lập đa tầng (RLS)</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Cổng thanh toán tự động payOS</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live App Preview Frame */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-200/50">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-rose-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-400">Bảng điều khiển quản lý</span>
                  <div className="w-9" />
                </div>

                <div className="mt-4 space-y-3">
                  {/* KPI Mini Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <p className="text-xs text-slate-500 font-medium">Doanh thu kỳ này</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">38.450.000 đ</p>
                      <p className="mt-0.5 text-[11px] text-emerald-600 font-medium">92% đã thu qua payOS</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <p className="text-xs text-slate-500 font-medium">Tỷ lệ lấp đầy</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">18 / 20 phòng</p>
                      <p className="mt-0.5 text-[11px] text-blue-600 font-medium">90% đang thuê</p>
                    </div>
                  </div>

                  {/* Invoice simulation item */}
                  <div className="rounded-xl border border-slate-200/70 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Phòng 204 · Hóa đơn T10/2026</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">Đã thanh toán</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                      <span>Điện: 142 kWh · Nước: 8 m³</span>
                      <span className="font-semibold text-slate-800">4.150.000 đ</span>
                    </div>
                  </div>

                  {/* AI Assistant snippet */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">AI</span>
                      <p className="text-xs font-semibold text-blue-950">Gợi ý từ Trợ lý AI</p>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      Đã phát hiện 2 phòng chưa chốt số điện nước kỳ này. Bạn có muốn gửi thông báo nhắc không?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="border-t border-slate-200/70 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">Tính năng trọng tâm</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Giải pháp toàn diện cho vòng đời vận hành
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Bento Card 1 */}
            <div className="rounded-2xl border border-slate-200/90 bg-[#fafbfc] p-6 flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  01
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Quản lý nhà trọ & phòng</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Thiết lập sơ đồ tòa nhà, tình trạng phòng (trống, đang thuê, bảo trì), hợp đồng thuê với giá cọc và chu kỳ linh hoạt.
                </p>
              </div>
              <div className="mt-6 border-t border-slate-200/60 pt-4 text-xs text-slate-400">
                Minh bạch lịch sử phòng & hợp đồng
              </div>
            </div>

            {/* Bento Card 2 */}
            <div className="rounded-2xl border border-slate-200/90 bg-[#fafbfc] p-6 flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  02
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Chỉ số điện nước & Dịch vụ</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Chốt chỉ số theo kỳ có cơ chế đối soát chống ghi lùi số, tự động tính tiền theo đơn giá bậc thang hoặc cố định theo hợp đồng.
                </p>
              </div>
              <div className="mt-6 border-t border-slate-200/60 pt-4 text-xs text-slate-400">
                Kiểm soát sai lệch chỉ số tiêu thụ
              </div>
            </div>

            {/* Bento Card 3 */}
            <div className="rounded-2xl border border-slate-200/90 bg-[#fafbfc] p-6 flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  03
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">Hóa đơn & QR payOS</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Sinh hóa đơn hàng loạt chỉ trong một chạm. Khách thuê quét mã VietQR payOS để thanh toán, hệ thống tự động gạch nợ tức thì.
                </p>
              </div>
              <div className="mt-6 border-t border-slate-200/60 pt-4 text-xs text-slate-400">
                Đối soát tự động qua Webhook
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Comparison: Landlord vs Renter */}
      <section className="border-t border-slate-200/70 bg-[#fafbfc] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold text-slate-900">Giao diện chuyên biệt cho từng đối tượng</h2>
            <p className="mt-3 text-slate-600">Đơn giản hóa nghiệp vụ cho chủ nhà trọ, tiện lợi cho người thuê phòng.</p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Dành cho Chủ trọ (Landlord)</span>
              <h3 className="mt-2 text-xl font-bold text-slate-900">Vận hành và giám sát dòng tiền</h3>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Bảng tổng quan doanh thu, tỷ lệ phòng trống theo thời gian thực.
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Lập hóa đơn và theo dõi công nợ chi tiết từng phòng.
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Tiếp nhận và xử lý phản ánh hỏng hóc từ khách thuê.
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Trợ lý AI hỗ trợ tra cứu và đề xuất tác vụ nhanh.
                </li>
              </ul>
              <div className="mt-8">
                <Link
                  href="/register"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Đăng ký tài khoản Chủ trọ
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Dành cho Khách thuê (Renter)</span>
              <h3 className="mt-2 text-xl font-bold text-slate-900">Minh bạch chỉ số và tiện lợi thanh toán</h3>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Xem thông tin hợp đồng, tiền cọc và thời hạn thuê.
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Theo dõi lịch sử chỉ số tiêu thụ điện, nước rõ ràng.
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Quét mã QR thanh toán tiền phòng trực tuyến nhanh chóng.
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Gửi phản ánh sự cố trực tiếp đến chủ trọ qua ứng dụng.
                </li>
              </ul>
              <div className="mt-8">
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Đăng nhập người thuê phòng
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900">Sẵn sàng số hóa quy trình quản lý nhà trọ?</h2>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">
            Bắt đầu trải nghiệm ngay hôm nay với gói dùng thử đầy đủ tính năng.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Đăng ký dùng thử ngay
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 Quản lý nhà trọ. Nền tảng quản lý vận hành đa người dùng (Multi-tenant SaaS).</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-slate-800 transition-colors">Đăng nhập</Link>
            <Link href="/register" className="hover:text-slate-800 transition-colors">Đăng ký</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
