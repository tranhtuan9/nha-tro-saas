-- ==============================================================================
-- BỔ SUNG CHÍNH SÁCH RLS CHO RENTER (LUẬT 4: RENTER CHỈ THẤY HỢP ĐỒNG CỦA MÌNH)
-- ==============================================================================

-- 1. contracts: Renter chỉ thấy hợp đồng của chính mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "contracts";
CREATE POLICY tenant_isolation_policy ON "contracts"
  FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- 2. invoices: Renter chỉ thấy hóa đơn thuộc các hợp đồng của mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoices";
CREATE POLICY tenant_isolation_policy ON "invoices"
  FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR contract_id IN (
        SELECT c.id FROM "contracts" c
        WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
  );

-- 3. invoice_line_items: Đi theo hóa đơn của Renter
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoice_line_items";
CREATE POLICY tenant_isolation_policy ON "invoice_line_items"
  FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR invoice_id IN (
        SELECT inv.id FROM "invoices" inv
        JOIN "contracts" c ON c.id = inv.contract_id
        WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
  );

-- 4. payments: Renter chỉ thấy các thanh toán thuộc hóa đơn của mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "payments";
CREATE POLICY tenant_isolation_policy ON "payments"
  FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR invoice_id IN (
        SELECT inv.id FROM "invoices" inv
        JOIN "contracts" c ON c.id = inv.contract_id
        WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

-- 5. support_requests: Renter chỉ thấy phản ánh do mình gửi
DROP POLICY IF EXISTS tenant_isolation_policy ON "support_requests";
CREATE POLICY tenant_isolation_policy ON "support_requests"
  FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- 6. notifications: Renter/User chỉ thấy thông báo gửi cho chính mình
DROP POLICY IF EXISTS tenant_isolation_policy ON "notifications";
CREATE POLICY tenant_isolation_policy ON "notifications"
  FOR ALL TO app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_role', true), '') IS DISTINCT FROM 'RENTER'
      OR user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
