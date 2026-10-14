-- Khởi tạo extension cần thiết
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tạo role app_user (API nghiệp vụ, không superuser, không BYPASSRLS, bị cưỡng chế bởi RLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'change_me' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- 2. Tạo role app_system (Auth, Webhook payOS, Admin, Seed; có BYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_system') THEN
    CREATE ROLE app_system WITH LOGIN PASSWORD 'change_me' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- 3. Cấp quyền kết nối database và schema public
GRANT CONNECT ON DATABASE nha_tro TO app_user;
GRANT CONNECT ON DATABASE nha_tro TO app_system;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO app_system;

-- 4. Cấp quyền mặc định cho các bảng và sequence do nha_tro_owner tạo
ALTER DEFAULT PRIVILEGES FOR ROLE nha_tro_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_system;

ALTER DEFAULT PRIVILEGES FOR ROLE nha_tro_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_system;

ALTER DEFAULT PRIVILEGES FOR ROLE nha_tro_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE nha_tro_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
