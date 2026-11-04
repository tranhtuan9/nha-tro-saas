import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Chính sách Bảo vệ Dữ liệu Cá nhân - Quản lý nhà trọ",
  description: "Chính sách xử lý và bảo vệ dữ liệu cá nhân theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 13/2023/NĐ-CP.",
};

export default function PrivacyPage() {
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
              Tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Chính sách Bảo vệ Dữ liệu Cá nhân
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Có hiệu lực từ: Ngày 01 tháng 01 năm 2026 · Áp dụng cho toàn bộ người dùng trên nền tảng
            </p>
          </div>

          <div className="prose prose-slate max-w-none space-y-8 text-sm sm:text-base leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                1. Cam kết Chung về Quyền riêng tư
              </h2>
              <p>
                Nền tảng Quản lý nhà trọ (sau đây gọi tắt là <strong>"Hệ thống"</strong>) cam kết bảo vệ dữ liệu cá nhân của mọi chủ thể dữ liệu (Chủ trọ, Người thuê phòng trọ) theo đúng quy định của <strong>Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15</strong> và Nghị định số 13/2023/NĐ-CP của Chính phủ.
              </p>
              <p className="mt-2">
                Hệ thống chỉ thu thập và xử lý dữ liệu khi có <strong>sự đồng ý tự nguyện, chủ động và tường minh</strong> của bạn. Chúng tôi tuyệt đối không mặc định rằng việc tiếp tục truy cập hay sử dụng website là sự đồng ý xử lý dữ liệu cá nhân.
              </p>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                2. Loại dữ liệu thu thập và Mục đích xử lý
              </h2>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs sm:text-sm border-collapse border border-slate-200 rounded-lg">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="p-3 border border-slate-200">Nhóm chủ thể</th>
                      <th className="p-3 border border-slate-200">Dữ liệu thu thập</th>
                      <th className="p-3 border border-slate-200">Mục đích xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 border border-slate-200 font-medium">Chủ nhà trọ (Landlord)</td>
                      <td className="p-3 border border-slate-200">Họ tên, Email, Số điện thoại, Tên chuỗi nhà trọ, Mật khẩu đã mã hóa (Hash).</td>
                      <td className="p-3 border border-slate-200">Khởi tạo và quản lý không gian thuê trọ (Tenant), gửi thông báo dịch vụ và quản trị thanh toán.</td>
                    </tr>
                    <tr>
                      <td className="p-3 border border-slate-200 font-medium">Người thuê (Renter)</td>
                      <td className="p-3 border border-slate-200">Họ tên, Số điện thoại, Số CCCD/Định danh cá nhân, Hợp đồng thuê phòng, Chỉ số tiêu thụ điện nước.</td>
                      <td className="p-3 border border-slate-200">Khai báo lưu trú phòng trọ, lập hóa đơn tiền phòng chính xác, cấp tài khoản thanh toán và nhận phản ánh sự cố.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                3. Biện pháp Kỹ thuật và Bảo mật Dữ liệu
              </h2>
              <p>
                Để bảo vệ an toàn cho dữ liệu người dùng khỏi hành vi rò rỉ, truy cập trái phép hoặc đánh cắp, Hệ thống áp dụng các nguyên tắc kỹ thuật nghiêm ngặt:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Cô lập dữ liệu cấp cơ sở dữ liệu (Row-Level Security - RLS):</strong> Mọi truy vấn dữ liệu được cưỡng chế cách ly theo từng Tenant riêng biệt; dữ liệu người thuê chỉ hiển thị với chính người thuê đó và chủ nhà trọ quản lý hợp đồng.
                </li>
                <li>
                  <strong>Mã hóa và Che giấu thông tin nhạy cảm:</strong> Mật khẩu được mã hóa an toàn bằng thuật toán băm (bcrypt/argon2); Số Căn cước công dân (CCCD) được che bớt ký tự hiển thị trên danh sách quản lý chung; tuyệt đối không ghi nhận số CCCD, mật khẩu vào hệ thống nhật ký máy chủ (Log files).
                </li>
                <li>
                  <strong>Minh bạch với Trí tuệ nhân tạo (Gemini AI):</strong> Tuyệt đối không gửi số CCCD, thông tin tài khoản ngân hàng hoặc mật khẩu của người dùng sang các dịch vụ trí tuệ nhân tạo bên thứ ba.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                4. Chia sẻ Dữ liệu cho Bên thứ ba
              </h2>
              <p>
                Hệ thống chỉ chia sẻ dữ liệu cần thiết tối thiểu cho các đối tác tích hợp phục vụ mục đích vận hành:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Cổng thanh toán payOS:</strong> Chia sẻ mã hóa đơn và số tiền cần thanh toán để tạo mã VietQR phục vụ thanh toán trực tuyến.
                </li>
                <li>
                  <strong>Cơ quan chức năng có thẩm quyền:</strong> Chỉ cung cấp thông tin cư trú khi có yêu cầu hợp pháp bằng văn bản theo đúng quy định của pháp luật Việt Nam.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                5. Quyền của Chủ thể Dữ liệu
              </h2>
              <p>
                Theo quy định của Luật Bảo vệ dữ liệu cá nhân, bạn có toàn quyền:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Quyền được biết & đồng ý:</strong> Được thông báo rõ mục đích và phạm vi thu thập trước khi đồng ý.</li>
                <li><strong>Quyền truy cập và chỉnh sửa:</strong> Xem và cập nhật thông tin cá nhân của mình thông qua màn hình Hồ sơ cá nhân.</li>
                <li><strong>Quyền rút lại sự đồng ý hoặc yêu cầu xóa dữ liệu:</strong> Sau khi thanh lý hợp đồng thuê và hoàn tất mọi nghĩa vụ tài chính, bạn có quyền yêu cầu xóa hoặc ẩn vĩnh viễn các thông tin cá nhân lưu trên hệ thống.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                6. Thông tin Liên hệ Bộ phận Bảo vệ Dữ liệu (DPO)
              </h2>
              <p>
                Nếu bạn có bất kỳ câu hỏi, khiếu nại hoặc muốn thực hiện quyền chủ thể dữ liệu của mình, vui lòng liên hệ:
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs sm:text-sm text-slate-600 space-y-1">
                <p><strong>Bộ phận An toàn & Bảo vệ Dữ liệu Cá nhân</strong></p>
                <p>Email tiếp nhận yêu cầu: privacy@quanlynhatro.vn</p>
                <p>Hotline hỗ trợ: 1900 6868</p>
                <p>Thời gian tiếp nhận và xử lý yêu cầu chủ thể dữ liệu: Tối đa 72 giờ làm việc kể từ khi nhận đủ thông tin xác thực.</p>
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
            <Link href="/terms" className="hover:text-slate-800 transition-colors">Điều khoản</Link>
            <Link href="/privacy" className="text-blue-600 font-semibold">Bảo vệ dữ liệu</Link>
            <Link href="/" className="hover:text-slate-800 transition-colors">Trang chủ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

