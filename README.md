# Hệ Thống Quản Lý Nhà Trọ SaaS (Multi-tenant)

> **Đồ án tốt nghiệp:** Xây dựng nền tảng SaaS Multi-tenant quản lý nhà trọ, tích hợp thanh toán trực tuyến VietQR (payOS) và Trợ lý AI thông minh hỗ trợ vận hành bằng tiếng Việt.

---

## 1. Giới thiệu đề tài

Hệ thống Quản lý Nhà trọ SaaS được thiết kế theo mô hình kiến trúc đa người dùng (Multi-tenant), giải quyết bài toán quản lý nhà trọ truyền thống vốn phân tán, thủ công và dễ sai sót. Hệ thống phục vụ ba nhóm tác nhân chính:

1. **Quản trị viên hệ thống (Admin SaaS):** Quản lý các nhà trọ đăng ký (Tenant), cấu hình và quản lý các gói dịch vụ (Plan), theo dõi doanh thu và trạng thái tài khoản.
2. **Chủ nhà trọ (Landlord):** Quản lý nhiều cơ sở nhà trọ, phòng trọ, trang thiết bị, dịch vụ, hợp đồng thuê, ghi chỉ số điện nước định kỳ, phát hành hóa đơn tự động và tương tác với Trợ lý AI để tối ưu hóa quy trình vận hành.
3. **Khách thuê trọ (Renter):** Cổng thông tin cá nhân giúp khách thuê theo dõi hợp đồng, xem lịch sử chỉ số điện nước, nhận hóa đơn chi tiết, thanh toán trực tuyến qua mã VietQR tự động và gửi phản ánh tới chủ trọ.

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ chính | Vai trò trong hệ thống |
|---|---|---|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, SWR, Axios | Giao diện web hiện đại, tốc độ tải nhanh, tương thích đa thiết bị |
| **Backend** | Node.js, Express, TypeScript, Zod | Xây dựng RESTful API chuẩn mực, kiểm thực dữ liệu chặt chẽ |
| **Cơ sở dữ liệu** | PostgreSQL 16 (Docker) + Row-Level Security (RLS) | Lưu trữ phân lập tuyệt đối giữa các Tenant ngay tại tầng CSDL |
| **ORM** | Prisma Client (kèm Prisma Extension cho RLS) | Truy vấn CSDL an toàn, tự động hóa migration và seed dữ liệu |
| **Trợ lý AI** | Google Gemini (Function Calling) | Hỗ trợ ngôn ngữ tự nhiên tiếng Việt, tra cứu và đề xuất nghiệp vụ |
| **Thanh toán** | payOS (VietQR Webhook) | Tích hợp cổng thanh toán trực tuyến quét mã QR ngân hàng tự động |
| **Kiểm thử** | Vitest, Supertest, Playwright | Kiểm thử tích hợp toàn diện trên CSDL PostgreSQL thật (hơn 440 tests) |

---

## 3. Yêu cầu môi trường cài đặt (Prerequisites)

Trước khi khởi chạy dự án, Thầy/Cô và người đánh giá vui lòng cài đặt các phần mềm nền tảng sau trên máy tính (hỗ trợ Windows, macOS và Linux):

| Phần mềm | Phiên bản yêu cầu | Hướng dẫn tải & Cài đặt | Cách kiểm tra trên Terminal |
|---|:---:|---|---|
| **Node.js** | `v20.x` hoặc `v22.x` (LTS)<br>*(Tối thiểu `v18.18+`)* | Tải bản cài đặt tại [nodejs.org](https://nodejs.org/). Cài đặt kèm theo trình quản lý gói `npm`. | `node -v`<br>`npm -v` |
| **Docker Desktop** | `v4.25+`<br>*(Docker Compose `v2.20+`)* | Tải tại [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/). Bắt buộc phải **bật ứng dụng Docker Desktop** trước khi chạy hệ thống. | `docker -v`<br>`docker compose version` |
| **Git** | `v2.40+` | Tải tại [git-scm.com](https://git-scm.com/) để tải mã nguồn dự án. | `git -v` |
| **ngrok** *(Tùy chọn)* | `v3.8+` | Dành cho việc thử nghiệm quét mã VietQR thật qua cổng payOS từ điện thoại: tải tại [ngrok.com/download](https://ngrok.com/download) (hoặc chạy lệnh Windows: `winget install ngrok`). | `ngrok -v` |

---

## 4. Hướng dẫn chạy dự án (Từng bước chi tiết)

Hệ thống được thiết kế vận hành với 3 thành phần độc lập:
- **Cơ sở dữ liệu:** PostgreSQL 16 (chạy container Docker tại cổng `5432`).
- **Máy chủ Backend API:** Node.js Express (chạy tại cổng `4000`).
- **Giao diện Frontend:** Next.js (chạy tại cổng `3000`).

---

### Bước 1: Khởi động cơ sở dữ liệu PostgreSQL (Docker)

1. Mở cửa sổ Terminal (PowerShell hoặc CMD) tại **thư mục gốc của dự án** (`nha-tro-saas`).
2. Khởi chạy container cơ sở dữ liệu:
   ```bash
   docker compose up -d
   ```
3. **Dấu hiệu thành công:** Terminal hiển thị `Container nha_tro_db Started` (trạng thái `healthy` tại cổng `5432`). Hệ thống đã tự động kích hoạt script phân quyền 3 role bảo mật CSDL (`nha_tro_owner`, `app_user`, `app_system`).

---

### Bước 2: Cài đặt và khởi chạy máy chủ Backend (Port 4000)

1. Mở một cửa sổ Terminal mới (Terminal 1), di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```

2. Tạo tệp cấu hình môi trường `.env` từ mẫu có sẵn:
   - Trên Windows (PowerShell):
     ```powershell
     Copy-Item .env.example .env
     ```
   - Trên Windows (CMD):
     ```cmd
     copy .env.example .env
     ```
   - Trên macOS / Linux:
     ```bash
     cp .env.example .env
     ```

   > [!NOTE]
   > **Lưu ý cấu hình tệp `backend/.env`:**
   > - Tệp `.env.example` chỉ cung cấp khung tên biến và các thông số kết nối CSDL mặc định (`change_me`) khớp với cấu hình trong `docker-compose.yml`. Các khóa bí mật bên thứ ba được để trống nhằm bảo mật.
   > - **Để chạy các nghiệp vụ quản lý cơ bản:** Giữ nguyên các giá trị mặc định của file `.env` vừa sao chép là có thể khởi chạy và nạp dữ liệu mẫu bình thường.
   > - **Để kích hoạt Trợ lý AI (Google Gemini):** Mở file `.env` và điền `GEMINI_API_KEY` (đăng ký lấy khóa miễn phí tại [Google AI Studio](https://aistudio.google.com/)).
   > - **Để kích hoạt cổng thanh toán online (payOS):** Điền bộ 3 khóa `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` (lấy tại trang quản trị [my.payos.vn](https://my.payos.vn/)) như hướng dẫn ở Bước 4.
   > - **Để kiểm thử gửi email:** Điền `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (tài khoản Gmail có tạo Mật khẩu ứng dụng - App Password).

3. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```

4. Tạo cấu trúc bảng CSDL và nạp dữ liệu mẫu hoàn chỉnh:
   ```bash
   npm run prisma:migrate
   npm run seed:demo
   ```
   *(Lệnh `seed:demo` sẽ tạo sẵn các nhà trọ, danh sách phòng, hợp đồng, bảng giá dịch vụ, chỉ số điện nước, hóa đơn và các tài khoản thử nghiệm theo kịch bản chấm thi).*

5. Khởi chạy Backend ở chế độ phát triển:
   ```bash
   npm run dev
   ```
   - **Dấu hiệu thành công:** Terminal hiển thị `Server is running on port 4000`.
   - Có thể kiểm tra bằng trình duyệt tại: `http://localhost:4000/api/health` (trả về `{"status":"ok"}`).
   - *Giữ nguyên cửa sổ Terminal này hoạt động.*

---

### Bước 3: Cài đặt và khởi chạy giao diện Frontend (Port 3000)

1. Mở thêm một cửa sổ Terminal mới (Terminal 2), di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   ```

2. Tạo tệp cấu hình môi trường `.env.local`:
   - Trên Windows (PowerShell):
     ```powershell
     Copy-Item .env.local.example .env.local
     ```
   - Trên Windows (CMD):
     ```cmd
     copy .env.local.example .env.local
     ```
   - Trên macOS / Linux:
     ```bash
     cp .env.local.example .env.local
     ```

3. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```

4. Khởi chạy ứng dụng Frontend:
   ```bash
   npm run dev
   ```
   - **Dấu hiệu thành công:** Terminal hiển thị `Ready in ...ms on http://localhost:3000`.
   - Mở trình duyệt web truy cập địa chỉ: **`http://localhost:3000`** để bắt đầu trải nghiệm.
   - *Giữ nguyên cửa sổ Terminal này hoạt động.*

---

### Bước 4: Cấu hình ngrok nhận Webhook payOS (Tùy chọn kiểm thử thanh toán online)

Khi khách thuê quét mã VietQR thật qua ứng dụng ngân hàng, máy chủ payOS sẽ gửi thông báo Webhook từ Internet về máy chủ cục bộ (`localhost:4000`) để tự động gạch nợ hóa đơn.

1. **Kích hoạt tài khoản ngrok (Chỉ làm lần đầu):**
   - Đăng ký tài khoản miễn phí tại [dashboard.ngrok.com](https://dashboard.ngrok.com/) và lấy mã Authtoken.
   - Chạy lệnh kích hoạt trên terminal (chạy ở bất kỳ đâu):
     ```bash
     ngrok config add-authtoken <TOKEN_CỦA_BẠN>
     ```

2. **Lấy Static Domain miễn phí:**
   - Truy cập [dashboard.ngrok.com/cloud-edge/domains](https://dashboard.ngrok.com/cloud-edge/domains) để copy 1 Static Domain được tặng miễn phí vĩnh viễn (ví dụ: `your-domain.ngrok-free.app` hoặc `your-domain.ngrok-free.dev`).

3. **Khởi chạy ngrok (Chọn 1 trong 2 cách):**
   - **Cách 1 (Nhanh nhất nếu có file bat):** Nhấp đúp chuột vào file `start-ngrok.bat` trong thư mục `C:\DISK D\ngrok` (hoặc vị trí bạn lưu ngrok).
   - **Cách 2 (Mở Terminal thứ 3):** Mở một cửa sổ Terminal mới tại bất kỳ thư mục nào và chạy:
     ```bash
     ngrok http --domain=your-domain.ngrok-free.app 4000
     ```
   - *Giữ nguyên cửa sổ ngrok chạy ngầm trong suốt quá trình demo thanh toán.*

4. **Đăng ký Webhook URL trên cổng payOS:**
   - Vào [my.payos.vn](https://my.payos.vn/) $\rightarrow$ Chọn Kênh thanh toán $\rightarrow$ **Cài đặt Webhook**.
   - Nhập đường dẫn: `https://your-domain.ngrok-free.app/api/webhooks/payos` và bấm **Xác nhận**.
   - *(Hoặc bạn mở file `backend/.env`, điền `PAYOS_WEBHOOK_URL` tương ứng, rồi mở terminal tại `backend` chạy lệnh: `npm run payos:confirm-webhook` để hệ thống tự động xác nhận qua SDK).*

5. **Trải nghiệm gạch nợ tự động:**
   - Đăng nhập khách thuê `tranthanhbinh@gmail.com` / `123456` tại `http://localhost:3000`.
   - Vào mục **Hóa đơn** $\rightarrow$ Bấm **Thanh toán ngay** $\rightarrow$ Quét mã VietQR chuyển khoản (số tiền thử nghiệm 2.000đ).
   - Hóa đơn tự động chuyển sang màu xanh **Đã thanh toán** và gửi thông báo chuông đến Chủ trọ ngay lập tức mà không cần tải lại trang!

---

## 5. Danh sách tài khoản thử nghiệm dành cho Thầy/Cô

Tất cả các tài khoản thử nghiệm dưới đây đều sử dụng chung một mật khẩu duy nhất: **`123456`**.

| Vai trò | Email đăng nhập | Mật khẩu | Mục đích thử nghiệm đề xuất |
|---|---|:---:|---|
| **Quản trị viên (Admin SaaS)** | `adminnhatro@gmail.com` | `123456` | Quản lý toàn bộ hệ thống, quản lý danh sách Tenant, cấu hình các gói dịch vụ (Plan), khóa/mở khóa người dùng |
| **Chủ nhà trọ (Landlord)** | `nguyenvanbinh@gmail.com` | `123456` | **Tài khoản đầy đủ dữ liệu nhất:** Quản lý 2 cơ sở nhà trọ, 10 phòng trọ, danh sách khách thuê, hợp đồng, hóa đơn, điện nước và Trợ lý AI |
| **Khách thuê (Renter)** | `tranthanhbinh@gmail.com` | `123456` | Cổng khách thuê: Xem phòng, hợp đồng, **trải nghiệm thanh toán hóa đơn online quét mã VietQR thật (payOS 2.000đ)** |
| **Khách thuê (Renter)** | `nguyenhoaian@gmail.com` | `123456` | Xem chi tiết hóa đơn sinh hoạt, gửi phản ánh sửa chữa phòng đến chủ nhà |
| **Chủ trọ gói hết hạn** | `leminhan@gmail.com` | `123456` | Kiểm tra chính sách: Gói thuê bao hết hạn vẫn xem được dữ liệu cũ nhưng bị chặn tạo mới |

---

## 6. Kịch bản trải nghiệm các tính năng chính

Thầy/Cô có thể đăng nhập và trải nghiệm các luồng nghiệp vụ tiêu biểu theo hướng dẫn dưới đây:

### Kịch bản 1: Nghiệp vụ Chủ nhà trọ & Trợ lý AI thông minh
- **Bước 1:** Đăng nhập với tài khoản `nguyenvanbinh@gmail.com` / mật khẩu `123456`.
- **Bước 2 (Trang tổng quan):** Quan sát các chỉ số thống kê (KPIs): tổng doanh thu trong kỳ, tỷ lệ lấp đầy phòng, số hóa đơn chưa thanh toán và các thông báo chuông mới nhất.
- **Bước 3 (Quản lý phòng & Hợp đồng):**
  - Vào mục **Nhà trọ & Phòng**: Xem danh sách phòng theo từng cơ sở (Bình Minh Cơ sở 1 và Cơ sở 2), lọc phòng theo trạng thái (*Đang thuê, Trống, Đang bảo trì*).
  - Vào mục **Người thuê & Hợp đồng**: Xem danh sách hợp đồng đang hiệu lực, thời hạn thuê, thông tin khách thuê và tiền đặt cọc.
- **Bước 4 (Ghi điện nước & Lập hóa đơn mẫu):**
  - Vào mục **Điện nước & Dịch vụ** $\rightarrow$ **Chỉ số điện nước**: Chọn phòng **P104** (đang để trống chỉ số kỳ 11/2026 để thử nghiệm), bấm **Ghi chỉ số** (Ví dụ: Điện mới `215`, Nước mới `42`).
  - Vào mục **Hóa đơn**: Bấm **+ Lập hóa đơn** chọn phòng **P104** (Kỳ 11/2026), hệ thống tự động kế thừa chỉ số vừa ghi và bảng giá các dịch vụ cố định (Wifi, rác, tiện ích) từ hợp đồng mà không cần gõ lại.
- **Bước 5 (Trải nghiệm Trợ lý AI thông minh):**
  - Bấm vào mục hoặc biểu tượng **Trợ lý AI** ở thanh điều hướng bên trái.
  - Thử nghiệm các câu hỏi bằng tiếng Việt:
    - *Tra cứu phòng trống:* `"Còn những phòng nào đang trống?"` $\rightarrow$ AI tự động gọi hàm `getVacantRooms` và liệt kê danh sách phòng trống kèm giá thuê.
    - *Tra cứu doanh thu:* `"Doanh thu tháng 10/2026 là bao nhiêu?"` $\rightarrow$ AI gọi hàm `getMonthlyRevenue` và báo cáo doanh thu từ các hóa đơn đã thanh toán.
    - *Lập hóa đơn qua AI (Human-in-the-Loop):* Nhập `"Lập hóa đơn cho phòng P102 kỳ 11/2026"` $\rightarrow$ AI phân tích chỉ số điện nước có sẵn của phòng P102 và xuất thẻ **Đề xuất lập hóa đơn**. Chủ nhà chỉ cần bấm nút **Xác nhận** trên màn hình để hệ thống chính thức phát hành hóa đơn.
    - *Đổi trạng thái phòng an toàn:* Nhập `"Chuyển phòng P105 sang bảo trì"` $\rightarrow$ AI tạo đề xuất `setRoomStatus`, yêu cầu xác nhận trước khi thực hiện cập nhật CSDL.

---

### Kịch bản 2: Nghiệp vụ Khách thuê trọ & Thanh toán trực tuyến payOS
- **Bước 1:** Đăng nhập với tài khoản `tranthanhbinh@gmail.com` / mật khẩu `123456`.
- **Bước 2:** Xem thông tin phòng đang thuê, tiền phòng hàng tháng, ngày bắt đầu và kết thúc hợp đồng.
- **Bước 3:** Vào mục **Hóa đơn**, chọn hóa đơn cần thanh toán.
- **Bước 4:** Bấm nút **Thanh toán trực tuyến**: Hệ thống gọi cổng payOS tạo liên kết thanh toán kèm mã VietQR thật (số tiền tượng trưng 2.000đ).
- **Bước 5:** Khi quét mã thanh toán từ ứng dụng ngân hàng, hệ thống nhận tín hiệu Webhook tức thì và tự động chuyển hóa đơn sang trạng thái **Đã thanh toán (PAID)** mà không cần chủ nhà xác nhận thủ công.
- **Bước 6:** Vào mục **Phản ánh / Khiếu nại** để gửi yêu cầu hỗ trợ sửa chữa trang thiết bị đến chủ trọ.

---

### Kịch bản 3: Nghiệp vụ Quản trị hệ thống (Admin SaaS)
- **Bước 1:** Đăng nhập với tài khoản `adminnhatro@gmail.com` / mật khẩu `123456`.
- **Bước 2 (Quản lý Tenant):** Xem danh sách tất cả các chủ trọ trên toàn hệ thống, ngày đăng ký, gói dịch vụ đang sử dụng và thời hạn thuê bao.
- **Bước 3 (Quản lý Gói dịch vụ):** Xem và chỉnh sửa các gói SaaS (Cơ bản, Nâng cao), cấu hình giới hạn số nhà trọ và số phòng tối đa cho từng gói.
- **Bước 4 (Bảo mật tài khoản):** Khóa hoặc mở khóa tài khoản người dùng khi cần thiết.
