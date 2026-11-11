# Hệ Thống Quản Lý Nhà Trọ SaaS (Multi-tenant)

> **Đồ án / Khóa luận tốt nghiệp:** Xây dựng nền tảng SaaS Multi-tenant quản lý nhà trọ, tích hợp thanh toán trực tuyến VietQR (payOS) và Trợ lý AI thông minh hỗ trợ vận hành bằng tiếng Việt.

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

## 3. Yêu cầu môi trường cài đặt

Để chạy thử nghiệm hệ thống, máy tính cần cài đặt sẵn:
- **Node.js**: Phiên bản `18.x` hoặc `20.x` trở lên ([Tải tại đây](https://nodejs.org/)).
- **Docker Desktop**: Đang khởi chạy để chạy PostgreSQL tự động ([Tải tại đây](https://www.docker.com/products/docker-desktop/)).
- **Git**: Để quản lý mã nguồn.

---

## 4. Hướng dẫn khởi động nhanh (Từng bước)

### Bước 1: Khởi động cơ sở dữ liệu PostgreSQL (Docker)

Mở terminal tại thư mục gốc của dự án và chạy lệnh:

```bash
docker compose up -d
```

Lệnh trên sẽ tự động khởi tạo container PostgreSQL 16 tại cổng `5432`, đồng thời kích hoạt script phân quyền 3 role cơ sở dữ liệu (`nha_tro_owner`, `app_user`, `app_system`).

---

### Bước 2: Cài đặt và nạp dữ liệu mẫu cho Backend

1. Mở terminal mới, di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```

2. Tạo file cấu hình môi trường `.env` từ mẫu có sẵn:
   - Trên Windows (PowerShell):
     ```powershell
     Copy-Item .env.example .env
     ```
   - Trên Linux / macOS:
     ```bash
     cp .env.example .env
     ```
   *(File `.env.example` đã được cấu hình sẵn các thông số mặc định tương thích hoàn toàn với Docker).*

3. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

4. Đồng bộ cấu trúc CSDL và nạp dữ liệu mẫu (Seed Data):
   ```bash
   npm run prisma:migrate
   npm run seed:demo
   ```
   *(Lệnh `seed:demo` sẽ tạo sẵn các nhà trọ, danh sách phòng, hợp đồng, chỉ số điện nước, hóa đơn và các tài khoản thử nghiệm đầy đủ).*

5. Khởi chạy máy chủ Backend:
   ```bash
   npm run dev
   ```
   Backend sẽ hoạt động tại địa chỉ: `http://localhost:4000` (Kiểm tra trạng thái tại: `http://localhost:4000/api/health`).

---

### Bước 3: Cài đặt và khởi chạy giao diện Frontend

1. Mở một cửa sổ terminal mới, di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   ```

2. Tạo file cấu hình môi trường `.env.local`:
   - Trên Windows (PowerShell):
     ```powershell
     Copy-Item .env.local.example .env.local
     ```
   - Trên Linux / macOS:
     ```bash
     cp .env.local.example .env.local
     ```

3. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

4. Khởi chạy ứng dụng Frontend:
   ```bash
   npm run dev
   ```
   Giao diện web sẽ sẵn sàng tại địa chỉ: **`http://localhost:3000`**.

---

## 5. Danh sách tài khoản thử nghiệm dành cho Thầy/Cô

Tất cả các tài khoản thử nghiệm dưới đây đều sử dụng chung một mật khẩu duy nhất: **`123456`**.

| Vai trò | Email đăng nhập | Mật khẩu | Mục đích thử nghiệm đề xuất |
|---|---|:---:|---|
| **Quản trị viên (Admin SaaS)** | `admin@demo.vn` | `123456` | Quản lý toàn bộ hệ thống, quản lý danh sách Tenant, cấu hình các gói dịch vụ (Plan), khóa/mở khóa người dùng |
| **Chủ nhà trọ (Landlord)** | `landlord.binhminh@demo.vn` | `123456` | **Tài khoản đầy đủ dữ liệu nhất:** Quản lý 2 cơ sở nhà trọ, 10 phòng trọ, danh sách khách thuê, hợp đồng, hóa đơn, điện nước và Trợ lý AI |
| **Khách thuê (Renter)** | `renter.binh@demo.vn` | `123456` | Cổng khách thuê: Xem phòng, hợp đồng, **trải nghiệm thanh toán hóa đơn online quét mã VietQR thật (payOS 2.000đ)** |
| **Khách thuê (Renter)** | `renter.an@demo.vn` | `123456` | Xem chi tiết hóa đơn sinh hoạt, gửi phản ánh sửa chữa phòng đến chủ nhà |
| **Chủ trọ gói hết hạn** | `landlord.minhan@demo.vn` | `123456` | Kiểm tra chính sách: Gói thuê bao hết hạn vẫn xem được dữ liệu cũ nhưng bị chặn tạo mới |

---

## 6. Kịch bản trải nghiệm các tính năng chính

Thầy/Cô có thể đăng nhập và trải nghiệm các luồng nghiệp vụ tiêu biểu theo hướng dẫn dưới đây:

### Kịch bản 1: Nghiệp vụ Chủ nhà trọ & Trợ lý AI thông minh
- **Bước 1:** Đăng nhập với tài khoản `landlord.binhminh@demo.vn` / mật khẩu `123456`.
- **Bước 2 (Trang tổng quan):** Quan sát các chỉ số thống kê (KPIs): tổng doanh thu trong tháng, tỷ lệ lấp đầy phòng, số hóa đơn chưa thanh toán.
- **Bước 3 (Quản lý phòng & Hợp đồng):**
  - Vào mục **Nhà trọ & Phòng**: Xem danh sách phòng theo từng cơ sở, lọc phòng theo trạng thái (*Đang thuê, Trống, Đang bảo trì*).
  - Vào mục **Hợp đồng**: Xem danh sách hợp đồng, thời hạn thuê, tiền đặt cọc.
- **Bước 4 (Điện nước & Hóa đơn):**
  - Vào mục **Chỉ số điện nước**: Xem lịch sử ghi chỉ số theo từng tháng.
  - Vào mục **Hóa đơn**: Lập hóa đơn mới, hệ thống tự động tính tiền điện, nước dựa trên mức tiêu thụ và đơn giá dịch vụ đã cấu hình.
- **Bước 5 (Trải nghiệm Trợ lý AI):**
  - Bấm vào biểu tượng **Trợ lý AI** ở góc màn hình.
  - Thử nghiệm các câu hỏi bằng tiếng Việt:
    - *Tra cứu phòng trống:* `"Còn những phòng nào đang trống?"` $\rightarrow$ AI tự động truy vấn CSDL và liệt kê danh sách phòng trống kèm giá thuê.
    - *Tra cứu doanh thu:* `"Doanh thu tháng 10/2026 là bao nhiêu?"` $\rightarrow$ AI tra cứu và báo cáo doanh thu từ các hóa đơn đã thanh toán.
    - *Cơ chế hỏi lại khi thiếu thông tin:* Nhập `"Tạo hóa đơn cho phòng P102"` $\rightarrow$ AI nhận diện thiếu kỳ thanh toán và lịch sự hỏi lại người dùng thay vì tự ý suy đoán kỳ quá khứ.
    - *Đề xuất nghiệp vụ có xác nhận (Human-in-the-Loop):* Nhập `"Chuyển phòng P105 sang bảo trì"` $\rightarrow$ AI tạo đề xuất và yêu cầu chủ nhà bấm nút **Xác nhận** trên giao diện trước khi thực thi cập nhật vào CSDL.

---

### Kịch bản 2: Nghiệp vụ Khách thuê trọ & Thanh toán trực tuyến payOS
- **Bước 1:** Đăng nhập với tài khoản `renter.binh@demo.vn` / mật khẩu `123456`.
- **Bước 2:** Xem thông tin phòng đang thuê, tiền phòng hàng tháng, ngày bắt đầu và kết thúc hợp đồng.
- **Bước 3:** Vào mục **Hóa đơn**, chọn hóa đơn cần thanh toán.
- **Bước 4:** Bấm nút **Thanh toán trực tuyến**: Hệ thống gọi cổng payOS tạo liên kết thanh toán kèm mã VietQR thật (số tiền tượng trưng 2.000đ).
- **Bước 5:** Khi quét mã thanh toán từ ứng dụng ngân hàng, hệ thống nhận tín hiệu Webhook tức thì và tự động chuyển hóa đơn sang trạng thái **Đã thanh toán (PAID)** mà không cần chủ nhà xác nhận thủ công.
- **Bước 6:** Vào mục **Phản ánh / Khiếu nại** để gửi yêu cầu hỗ trợ sửa chữa trang thiết bị đến chủ trọ.

---

### Kịch bản 3: Nghiệp vụ Quản trị hệ thống (Admin SaaS)
- **Bước 1:** Đăng nhập với tài khoản `admin@demo.vn` / mật khẩu `123456`.
- **Bước 2 (Quản lý Tenant):** Xem danh sách tất cả các chủ trọ trên toàn hệ thống, ngày đăng ký, gói dịch vụ đang sử dụng và thời hạn thuê bao.
- **Bước 3 (Quản lý Gói dịch vụ):** Xem và chỉnh sửa các gói SaaS (Cơ bản, Nâng cao), cấu hình giới hạn số nhà trọ và số phòng tối đa cho từng gói.
- **Bước 4 (Bảo mật tài khoản):** Khóa hoặc mở khóa tài khoản người dùng khi cần thiết.

---

## 7. Điểm nổi bật về kiến trúc và an toàn hệ thống

1. **Phân lập dữ liệu triệt để với PostgreSQL Row-Level Security (RLS):**
   - Không chỉ dựa vào mệnh đề `WHERE tenant_id = ...` ở tầng ứng dụng, hệ thống kích hoạt chính sách RLS trực tiếp trong lõi CSDL PostgreSQL.
   - Phân chia 3 vai trò CSDL rõ ràng:
     - `nha_tro_owner`: Chỉ dùng để chạy migration và seed dữ liệu.
     - `app_user`: Dành cho toàn bộ API nghiệp vụ thường nhật, bị RLS bắt buộc cô lập dữ liệu theo từng Tenant và từng Khách thuê.
     - `app_system`: Có quyền `BYPASSRLS`, chỉ dùng giới hạn cho module xác thực, webhook thanh toán và admin hệ thống.
2. **Trợ lý AI thiết kế theo nguyên tắc an toàn nghiệp vụ:**
   - **Mô hình Human-in-the-Loop:** AI không bao giờ tự ý sửa đổi hay ghi đè CSDL mà chỉ tạo đề xuất dạng `PROPOSED`; chỉ khi chủ nhà chủ động bấm xác nhận trên màn hình thì thao tác mới được ghi nhận.
   - **Quy tắc hỏi lại khi thiếu dữ liệu:** AI không được phép tự ý bịa đặt kỳ thanh toán, ngày tháng hay số tiền nếu người dùng chưa cung cấp đủ thông tin.
   - **Chống Prompt Injection:** Dữ liệu tra cứu được đặt trong khối cách ly an toàn, ngăn chặn người dùng chèn chỉ thị độc hại để thao túng câu lệnh hệ thống.
3. **Tích hợp thanh toán payOS chuẩn xác thực chữ ký:**
   - Xác thực chữ ký số bằng thuật toán HMAC-SHA256 trên raw body của Webhook.
   - Xử lý giao dịch theo nguyên tắc Idempotent: đảm bảo một giao dịch không bao giờ bị cộng tiền hoặc kích hoạt trạng thái hai lần.

---

## 8. Chạy kiểm thử tự động (Automated Testing)

Toàn bộ hệ thống được bảo vệ bởi bộ kiểm thử tích hợp chạy trực tiếp trên cơ sở dữ liệu PostgreSQL thật (không mock database):

```bash
cd backend
npm test
```

*Kết quả kiểm thử đạt 17/17 test suites, 444/444 test cases thành công.*
