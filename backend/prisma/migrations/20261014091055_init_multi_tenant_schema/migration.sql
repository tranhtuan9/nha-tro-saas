-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'LANDLORD', 'RENTER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "room_status" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('ACTIVE', 'ENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('UNPAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "audit_source" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "audit_status" AS ENUM ('PROPOSED', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "support_type" AS ENUM ('COMPLAINT', 'REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "support_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "max_properties" INTEGER NOT NULL,
    "max_rooms" INTEGER NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'ACTIVE',
    "subscription_start" DATE NOT NULL,
    "subscription_end" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20),
    "national_id" VARCHAR(20),
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "electricity_unit_price" DECIMAL(12,0) NOT NULL,
    "water_unit_price" DECIMAL(12,0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "room_code" VARCHAR(30) NOT NULL,
    "area_m2" DECIMAL(6,2),
    "base_price" DECIMAL(12,0) NOT NULL,
    "status" "room_status" NOT NULL DEFAULT 'AVAILABLE',
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "renter_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "monthly_rent" DECIMAL(12,0) NOT NULL,
    "deposit" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "terms" TEXT,
    "status" "contract_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "billing_month" DATE NOT NULL,
    "electricity_index" DECIMAL(10,2) NOT NULL,
    "water_index" DECIMAL(10,2) NOT NULL,
    "electricity_usage" DECIMAL(10,2) NOT NULL,
    "water_usage" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "unit_price" DECIMAL(12,0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "meter_reading_id" UUID NOT NULL,
    "billing_month" DATE NOT NULL,
    "electricity_unit_price" DECIMAL(12,0) NOT NULL,
    "water_unit_price" DECIMAL(12,0) NOT NULL,
    "rent_amount" DECIMAL(12,0) NOT NULL,
    "electricity_amount" DECIMAL(12,0) NOT NULL,
    "water_amount" DECIMAL(12,0) NOT NULL,
    "service_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,0) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'UNPAID',
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "service_name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "unit_price" DECIMAL(12,0) NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "order_code" BIGINT NOT NULL,
    "payment_link_id" VARCHAR(100),
    "amount" DECIMAL(12,0) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "entity_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" "audit_source" NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "audit_status" NOT NULL DEFAULT 'PROPOSED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ,
    "executed_at" TIMESTAMPTZ,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "renter_id" UUID NOT NULL,
    "type" "support_type" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "support_status" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "responded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_phone_key" ON "users"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_national_id_key" ON "users"("tenant_id", "national_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "properties_tenant_id_idx" ON "properties"("tenant_id");

-- CreateIndex
CREATE INDEX "rooms_tenant_id_idx" ON "rooms"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_property_id_room_code_key" ON "rooms"("property_id", "room_code");

-- CreateIndex
CREATE INDEX "contracts_tenant_id_idx" ON "contracts"("tenant_id");

-- CreateIndex
CREATE INDEX "contracts_room_id_idx" ON "contracts"("room_id");

-- CreateIndex
CREATE INDEX "contracts_renter_id_idx" ON "contracts"("renter_id");

-- CreateIndex
CREATE INDEX "meter_readings_tenant_id_idx" ON "meter_readings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "meter_readings_room_id_billing_month_key" ON "meter_readings"("room_id", "billing_month");

-- CreateIndex
CREATE INDEX "services_tenant_id_idx" ON "services"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_property_id_name_key" ON "services"("property_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_meter_reading_id_key" ON "invoices"("meter_reading_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_contract_id_billing_month_key" ON "invoices"("contract_id", "billing_month");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_line_items_tenant_id_idx" ON "invoice_line_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_code_key" ON "payments"("order_code");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_user_id_created_at_idx" ON "audit_logs"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "support_requests_tenant_id_idx" ON "support_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "support_requests_renter_id_idx" ON "support_requests"("renter_id");

-- CreateIndex
CREATE INDEX "support_requests_tenant_id_status_idx" ON "support_requests"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_meter_reading_id_fkey" FOREIGN KEY ("meter_reading_id") REFERENCES "meter_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================================================================
-- 1. ROW LEVEL SECURITY (RLS) FOR ALL TENANT TABLES & APP_USER
-- ==============================================================================

-- Bảng tenants: Chỉ truy cập bản ghi của chính tenant
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_isolation_policy ON "tenants"
  FOR ALL
  TO app_user
  USING (id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

-- Bảng plans: Chỉ đọc cho app_user
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;

CREATE POLICY plan_read_policy ON "plans"
  FOR SELECT
  TO app_user
  USING (true);

-- Bảng password_reset_tokens: RLS thông qua user.tenant_id
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;

CREATE POLICY password_reset_token_isolation_policy ON "password_reset_tokens"
  FOR ALL
  TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM "users" u
      WHERE u.id = "password_reset_tokens".user_id
      AND u.tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "users" u
      WHERE u.id = "password_reset_tokens".user_id
      AND u.tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    )
  );

-- Các bảng có cột tenant_id
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "users"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "properties" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "properties"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "rooms"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contracts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "contracts"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "meter_readings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meter_readings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "meter_readings"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "services"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "invoices"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "invoice_line_items"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "payments"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "notifications"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "audit_logs"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

ALTER TABLE "support_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "support_requests"
  FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

-- ==============================================================================
-- 2. PARTIAL UNIQUE INDEXES & CHECK CONSTRAINTS TỪ DBML
-- ==============================================================================

-- Mỗi phòng chỉ có 1 hợp đồng ACTIVE tại một thời điểm
CREATE UNIQUE INDEX "uq_contract_active_room" ON "contracts"("room_id") WHERE "status" = 'ACTIVE';

-- Ngày kết thúc hợp đồng phải sau ngày bắt đầu
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_dates" CHECK ("end_date" > "start_date");

-- Số lượng trên dòng hóa đơn phải > 0
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "chk_line_item_quantity" CHECK ("quantity" > 0);

-- tenant_id chỉ được NULL khi role = ADMIN
ALTER TABLE "users" ADD CONSTRAINT "chk_user_tenant_admin" CHECK (
  ("role" = 'ADMIN' AND "tenant_id" IS NULL) OR
  ("role" != 'ADMIN' AND "tenant_id" IS NOT NULL)
);

-- ==============================================================================
-- 3. CẤP QUYỀN VAI TRÒ CSDL (ROLES PERMISSIONS)
-- ==============================================================================

-- Cấp quyền cho app_system (Auth, Webhook payOS, Admin, Seed; có BYPASSRLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_system;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_system;

-- Cấp quyền nghiệp vụ cho app_user (bị RLS cưỡng chế)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- audit_logs CHỈ cấp INSERT và SELECT cho app_user (Append-only)
REVOKE UPDATE, DELETE ON TABLE "audit_logs" FROM app_user;

-- plans CHỈ cấp SELECT cho app_user (Gói do admin quản lý)
REVOKE INSERT, UPDATE, DELETE ON TABLE "plans" FROM app_user;

