# Hệ thống quản lý nhà trọ SaaS (Multi-tenant)

Nền tảng quản lý nhà trọ nhiều chủ sở hữu: Landlord quản lý bất động sản, phòng, hợp đồng, chỉ số điện nước, hóa đơn và thông báo; Renter theo dõi và thanh toán hóa đơn trực tuyến. Tích hợp Trợ lý AI hỗ trợ chủ trọ tra cứu và xử lý nghiệp vụ bằng ngôn ngữ tự nhiên.

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
docker-compose.yml PostgreSQL 16
```

## Bắt đầu nhanh

### 1. Cấu hình môi trường

```powershell
Copy-Item backend/.env.example backend/.env
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
npm run dev
# hoặc chạy production:
npm run build
npm start
```

Health check: `GET http://localhost:4000/api/health`

### 5. Chạy kiểm thử

Test tích hợp chạy trên PostgreSQL thật trong Docker (không mock CSDL), kết nối bằng `app_user`:

```powershell
cd backend
npm test
```
