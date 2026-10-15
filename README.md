# Hệ thống quản lý nhà trọ SaaS (Multi-tenant)

Nền tảng quản lý nhà trọ nhiều chủ sở hữu: Landlord quản lý bất động sản, phòng, hợp đồng, chỉ số điện nước, hóa đơn, thanh toán và thông báo; Renter theo dõi và thanh toán hóa đơn. AI Agent hỗ trợ thao tác theo white-list function.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (Docker) + Row-Level Security (RLS) |
| Frontend | Next.js, TypeScript, Tailwind, SWR, Axios |
| Tích hợp | Google Gemini (Function Calling), payOS (Webhook), Nodemailer |
| Kiểm thử | Vitest + Supertest |

## Cấu trúc thư mục

```
backend/
  prisma/          schema.prisma, migrations (gộp 1 file), seed.ts
  src/
    lib/           db, jwt, mail, payos, gemini, ApiError, asyncHandler
    middleware/    auth, tenantGuard, errorHandler
    modules/       <ten>/{routes,controller,service,schema}.ts
  tests/           *.test.ts (tích hợp, chạy trên PostgreSQL thật)
docker/            init-db.sql (tạo role app_user / app_system)
docs/              business-rules.md, schema.dbml, overview/, design/, ui/
docker-compose.yml PostgreSQL 16
```

## Bắt đầu nhanh

### 1. Cấu hình môi trường

```powershell
Copy-Item .env.example .env
# rồi điền giá trị thực tế
```

Các biến bắt buộc: `DATABASE_URL`, `APP_DATABASE_URL`, `SYSTEM_DATABASE_URL`, `JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `FRONTEND_URL`.

Ba role database tách bạch:

| Role | Env var | Dùng cho |
|---|---|---|
| `nha_tro_owner` | `DATABASE_URL` | migration, seed |
| `app_user` | `APP_DATABASE_URL` | API nghiệp vụ (bị RLS) |
| `app_system` | `SYSTEM_DATABASE_URL` | module auth, webhook payOS, admin (BYPASSRLS) |

### 2. Khởi động PostgreSQL

```powershell
docker compose up -d
```

### 3. Cài đặt và migrate

```powershell
cd backend
npm install
npm run prisma:migrate
npm run seed
```

### 4. Chạy backend

```powershell
cd backend
npm run build
node dist/index.js
# hoặc chạy dev với tsx
```

Health check: `GET http://localhost:4000/api/health`

### 5. Chạy kiểm thử

Test tích hợp chạy trên PostgreSQL thật trong Docker (không mock CSDL), kết nối bằng `app_user`:

```powershell
cd backend
npm test
```

## API

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/health` | GET | Kiểm tra trạng thái server |
| `/api/auth/register` | POST | Đăng ký Landlord (tạo Tenant + User trong 1 transaction) |
| `/api/auth/login` | POST | Đăng nhập (rate limit 10 lần / 15 phút) |
| `/api/auth/forgot-password` | POST | Gửi email đặt lại mật khẩu (rate limit 5 lần / 1 giờ) |
| `/api/auth/reset-password` | POST | Đặt lại mật khẩu bằng token |
| `/api/auth/profile` | GET/PATCH | Xem/sửa hồ sơ |
| `/api/auth/change-password` | POST | Đổi mật khẩu |
| `/api/admin/users` | GET | Danh sách người dùng |
| `/api/admin/users/:id/lock` `/unlock` | PATCH | Khóa/mở khóa tài khoản (idempotent) |
| `/api/admin/tenants` | GET | Danh sách Tenant |
| `/api/admin/tenants/:id` | GET | Chi tiết Tenant |
| `/api/admin/tenants/:id/suspend` `/activate` | PATCH | Tạm ngưng/kích hoạt Tenant (idempotent) |
| `/api/admin/tenants/:id/plan` | PATCH | Đổi gói và gia hạn |
| `/api/admin/plans` | GET/POST | Danh sách/tạo gói dịch vụ |
| `/api/admin/plans/:id` | PATCH | Cập nhật gói |
| `/api/admin/plans/:id/deactivate` | PATCH | Ẩn gói (idempotent) |

### Định dạng lỗi

Tất cả lỗi trả về thống nhất:

```json
{ "error": { "code": "STABLE_CODE", "message": "Thông báo tiếng Việt", "details": {} } }
```

- `code` ổn định, `message` tiếng Việt có dấu.
- Lỗi 500 không lộ stack trace hay SQL ra client.
- Đăng nhập sai và quên mật khẩu dùng thông báo chung.

## Quy tắc bắt buộc

1. `tenant_id` chỉ lấy từ JWT đã xác thực, không lấy từ body/query/tham số AI sinh ra.
2. Mọi truy vấn nghiệp vụ chạy trong transaction có `set_config('app.current_tenant', <id>, true)`.
3. Không xóa cứng Property/Room/Service/Plan; dùng `is_active` hoặc `status`.
4. Webhook payOS dùng raw body và xác thực chữ ký, không tin redirect.
5. AI Agent chỉ gọi function trong white-list, thao tác ghi dữ liệu qua xác nhận và AuditLog.
6. Không log mật khẩu/token/OTP/số CCCD; bí mật chỉ nằm trong `.env`.
7. Tenant hết hạn: vẫn đăng nhập và xem, chặn tạo mới dữ liệu nghiệp vụ.

Chi tiết đầy đủ xem `AGENTS.md` và `docs/business-rules.md`.
