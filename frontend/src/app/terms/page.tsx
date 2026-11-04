import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Điều khoản dịch vụ - Quản lý nhà trọ",
  description: "Quy định sử dụng và điều khoản dịch vụ của nền tảng Quản lý nhà trọ (SaaS).",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 group">
            <Logo className="h-8 w-auto text-blue-600 transition-transform group-hover:scale-105" />
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/" className="text-slate-600 hover:text-slate-900 transition-colors">
              Trang chủ
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-sm">
          <div className="border-b border-slate-200 pb-6 mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-3">
              Văn bản pháp lý áp dụng
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Điều khoản Dịch vụ
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Có hiệu lực từ: Ngày 01 tháng 01 năm 2026 · Cập nhật theo Luật Giao dịch điện tử và Luật Thương mại điện tử
            </p>
          </div>

          <div className="prose prose-slate max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                1. Giới thiệu và Phạm vi áp dụng
              </h2>
              <p>
                Chào mừng bạn đến với nền tảng phần mềm Quản lý nhà trọ (sau đây gọi tắt là <strong>"Hệ thống"</strong> hoặc <strong>"Nền tảng"</strong>).
                Bằng việc đăng ký tài khoản hoặc sử dụng bất kỳ dịch vụ nào trên Hệ thống, bạn (bao gồm Chủ trọ, Quản trị viên và Người thuê)
                đồng ý chịu ràng buộc bởi các Điều khoản Dịch vụ này.
              </p>
              <p className="mt-2">
                Hệ thống hoạt động dưới mô hình Phần mềm dạng Dịch vụ (SaaS - Software as a Service), cung cấp công cụ số hóa phục vụ việc quản lý phòng trọ,
                hợp đồng thuê, chỉ số điện nước, lập hóa đơn, hỗ trợ thu hộ qua cổng thanh toán trực tuyến và trợ lý AI thông minh.
              </p>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                2. Phân định Vai trò và Trách nhiệm
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Bên cung cấp Nền tảng (Hệ thống):</strong> Cung cấp hạ tầng kỹ thuật, đảm bảo tính sẵn sàng, bảo mật thông tin và tính toàn vẹn dữ liệu
                  cô lập theo từng chủ trọ (Multi-tenant). Nền tảng không phải là bên cho thuê phòng và không tham gia trực tiếp vào thỏa thuận dân sự giữa Chủ trọ và Người thuê.
                </li>
                <li>
                  <strong>Chủ trọ (Landlord):</strong> Là bên trực tiếp quản lý cơ sở lưu trú, thiết lập đơn giá phòng, định mức dịch vụ, phát hành hóa đơn và giải quyết các khiếu nại phát sinh từ người thuê. Chủ trọ chịu trách nhiệm về tính chính xác của các số liệu và hợp đồng lưu trữ trên hệ thống.
                </li>
                <li>
                  <strong>Người thuê (Renter):</strong> Có trách nhiệm bảo mật thông tin tài khoản được cấp, thanh toán hóa đơn theo đúng hạn đã thông báo và sử dụng tiện ích phản ánh đúng mục đích văn minh.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                3. Quản lý Tài khoản và Bảo mật
              </h2>
              <p>
                Người dùng phải cung cấp thông tin chính xác, trung thực khi đăng ký. Mọi hoạt động phát sinh từ tài khoản đăng nhập được coi là hành động của chủ tài khoản.
                Nếu phát hiện nghi vấn lộ thông tin mật khẩu hoặc truy cập trái phép, bạn cần thực hiện đổi mật khẩu ngay hoặc liên hệ quản trị hệ thống.
              </p>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                4. Hóa đơn và Thanh toán Trực tuyến
              </h2>
              <p>
                Hệ thống tích hợp cổng thanh toán trực tuyến payOS hỗ trợ thanh toán qua mã VietQR an toàn theo thời gian thực.
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Xác nhận tự động:</strong> Hóa đơn chỉ được chuyển trạng thái Đã thanh toán (PAID) khi hệ thống nhận được dữ liệu xác thực Webhook chính thức từ cổng thanh toán.
                </li>
                <li>
                  <strong>Tính bất biến:</strong> Hóa đơn sau khi đã thanh toán hoặc đã chốt số liệu không thể sửa đổi đơn phương nhằm bảo đảm tính minh bạch đối soát.
                </li>
                <li>
                  <strong>Xử lý hoàn tiền:</strong> Mọi yêu cầu tra soát hoặc hoàn tiền đối với các giao dịch chuyển nhầm, trùng lặp sẽ do Chủ trọ và Người thuê phối hợp xử lý dựa trên sao kê và chứng từ giao dịch.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                5. Cơ chế Trợ lý AI và Tính minh bạch
              </h2>
              <p>
                Hệ thống tích hợp tính năng Trợ lý AI nhằm hỗ trợ Chủ trọ tra cứu dữ liệu, gợi ý lập hóa đơn và phân tích số liệu nhanh chóng.
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Tính chất tham khảo:</strong> Mọi phản hồi và gợi ý của Trợ lý AI đều mang tính hỗ trợ vận hành và không thay thế cho quyết định của con người.
                </li>
                <li>
                  <strong>Xác nhận trước khi thực hiện:</strong> Hệ thống tuân thủ nguyên tắc Human-in-the-loop: Mọi hành động làm thay đổi dữ liệu (tạo hóa đơn, cập nhật phòng...) do AI đề xuất bắt buộc phải được Chủ trọ chủ động duyệt và xác nhận trước khi ghi nhận vào cơ sở dữ liệu.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                6. Ngừng cung cấp dịch vụ và Chấm dứt
              </h2>
              <p>
                Hệ thống có quyền tạm ngưng hoặc chấm dứt tài khoản nếu phát hiện hành vi cố ý tấn công an ninh mạng, gian lận thanh toán hoặc sử dụng dịch vụ vào mục đích vi phạm pháp luật Việt Nam.
              </p>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                7. Thông tin liên hệ và Hỗ trợ
              </h2>
              <p>
                Mọi ý kiến đóng góp hoặc yêu cầu giải quyết vướng mắc, khiếu nại xin vui lòng gửi về:
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs sm:text-sm text-slate-600 space-y-1">
                <p><strong>Nền tảng Quản lý nhà trọ SaaS</strong></p>
                <p>Hỗ trợ kỹ thuật: hotro@quanlynhatro.vn</p>
                <p>Hotline tiếp nhận: 1900 6868 (Giờ hành chính: 08:00 - 17:30)</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 Quản lý nhà trọ. Nền tảng quản lý vận hành đa người dùng (Multi-tenant SaaS).</p>
          <div className="flex gap-6">
            <Link href="/terms" className="text-blue-600 font-semibold">Điều khoản</Link>
            <Link href="/privacy" className="hover:text-slate-800 transition-colors">Bảo vệ dữ liệu</Link>
            <Link href="/" className="hover:text-slate-800 transition-colors">Trang chủ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

