-- ==============================================================================
-- CHUYỂN RLS TỪ PERMISSIVE SANG RESTRICTIVE
-- Mục tiêu: Renter chỉ thấy dữ liệu liên quan đến hợp đồng của mình.
-- Không có policy PERMISSIVE nào OR với policy khác.
-- ==============================================================================

-- 1. users: Renter chỉ thấy dòng của chính mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
CREATE POLICY tenant_isolation_policy ON "users"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      ELSE tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    END
  )
  WITH CHECK (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      ELSE tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    END
  );

-- 2. properties: Renter chỉ thấy nhà trọ chứa phòng thuộc hợp đồng của mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "properties";
CREATE POLICY tenant_isolation_policy ON "properties"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR id IN (
        SELECT r.property_id FROM "rooms" r
        WHERE r.id IN (
          SELECT c.room_id FROM "contracts" c
          WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
  );

-- 3. rooms: Renter chỉ thấy phòng thuộc hợp đồng của mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "rooms";
CREATE POLICY tenant_isolation_policy ON "rooms"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR id IN (
        SELECT c.room_id FROM "contracts" c
        WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
  );

-- 4. contracts: Renter chỉ thấy hợp đồng của chính mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "contracts";
CREATE POLICY tenant_isolation_policy ON "contracts"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
  );

-- 5. meter_readings: Renter chỉ thấy chỉ số của phòng thuộc hợp đồng
DROP POLICY IF EXISTS tenant_isolation_policy ON "meter_readings";
CREATE POLICY tenant_isolation_policy ON "meter_readings"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR room_id IN (
        SELECT c.room_id FROM "contracts" c
        WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
  );

-- 6. services: Renter chỉ thấy dịch vụ của property liên quan đến hợp đồng
DROP POLICY IF EXISTS tenant_isolation_policy ON "services";
CREATE POLICY tenant_isolation_policy ON "services"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR property_id IN (
        SELECT r.property_id FROM "rooms" r
        WHERE r.id IN (
          SELECT c.room_id FROM "contracts" c
          WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
  );

-- 7. invoices: Renter chỉ thấy hóa đơn thuộc hợp đồng của mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoices";
CREATE POLICY tenant_isolation_policy ON "invoices"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR contract_id IN (
        SELECT c.id FROM "contracts" c
        WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
  );

-- 8. invoice_line_items: Renter chỉ thấy dòng hóa đơn thuộc hợp đồng của mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoice_line_items";
CREATE POLICY tenant_isolation_policy ON "invoice_line_items"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR invoice_id IN (
        SELECT inv.id FROM "invoices" inv
        WHERE inv.contract_id IN (
          SELECT c.id FROM "contracts" c
          WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
  );

-- 9. payments: Renter chỉ thấy thanh toán thuộc hóa đơn của mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "payments";
CREATE POLICY tenant_isolation_policy ON "payments"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR invoice_id IN (
        SELECT inv.id FROM "invoices" inv
        WHERE inv.contract_id IN (
          SELECT c.id FROM "contracts" c
          WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- 10. support_requests: Renter chỉ thấy phản ánh do mình gửi
DROP POLICY IF EXISTS tenant_isolation_policy ON "support_requests";
CREATE POLICY tenant_isolation_policy ON "support_requests"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- 11. notifications: Renter chỉ thấy thông báo gửi cho mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "notifications";
CREATE POLICY tenant_isolation_policy ON "notifications"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      current_setting('app.current_role', true) IS DISTINCT FROM 'RENTER'
      OR user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
