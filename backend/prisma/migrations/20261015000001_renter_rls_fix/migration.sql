-- ==============================================================================
-- FIX RLS: Kết hợp PERMISSIVE (tenant isolation) + RESTRICTIVE (renter scope)
-- ==============================================================================

-- 1. users
DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
CREATE POLICY tenant_isolation_policy ON "users"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "users"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      ELSE TRUE
    END
  );

-- 2. properties
DROP POLICY IF EXISTS tenant_isolation_policy ON "properties";
CREATE POLICY tenant_isolation_policy ON "properties"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "properties"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN id IN (
          SELECT r.property_id FROM "rooms" r
          WHERE r.id IN (
            SELECT c.room_id FROM "contracts" c
            WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
      ELSE TRUE
    END
  );

-- 3. rooms
DROP POLICY IF EXISTS tenant_isolation_policy ON "rooms";
CREATE POLICY tenant_isolation_policy ON "rooms"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "rooms"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN id IN (
          SELECT c.room_id FROM "contracts" c
          WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      ELSE TRUE
    END
  );

-- 4. contracts
DROP POLICY IF EXISTS tenant_isolation_policy ON "contracts";
CREATE POLICY tenant_isolation_policy ON "contracts"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "contracts"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      ELSE TRUE
    END
  );

-- 5. meter_readings
DROP POLICY IF EXISTS tenant_isolation_policy ON "meter_readings";
CREATE POLICY tenant_isolation_policy ON "meter_readings"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "meter_readings"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN room_id IN (
          SELECT c.room_id FROM "contracts" c
          WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      ELSE TRUE
    END
  );

-- 6. services
DROP POLICY IF EXISTS tenant_isolation_policy ON "services";
CREATE POLICY tenant_isolation_policy ON "services"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "services"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN property_id IN (
          SELECT r.property_id FROM "rooms" r
          WHERE r.id IN (
            SELECT c.room_id FROM "contracts" c
            WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
      ELSE TRUE
    END
  );

-- 7. invoices
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoices";
CREATE POLICY tenant_isolation_policy ON "invoices"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "invoices"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN contract_id IN (
          SELECT c.id FROM "contracts" c
          WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      ELSE TRUE
    END
  );

-- 8. invoice_line_items
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoice_line_items";
CREATE POLICY tenant_isolation_policy ON "invoice_line_items"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "invoice_line_items"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN invoice_id IN (
          SELECT inv.id FROM "invoices" inv
          WHERE inv.contract_id IN (
            SELECT c.id FROM "contracts" c
            WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
      ELSE TRUE
    END
  );

-- 9. payments
DROP POLICY IF EXISTS tenant_isolation_policy ON "payments";
CREATE POLICY tenant_isolation_policy ON "payments"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "payments"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN invoice_id IN (
          SELECT inv.id FROM "invoices" inv
          WHERE inv.contract_id IN (
            SELECT c.id FROM "contracts" c
            WHERE c.renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
      ELSE TRUE
    END
  );

-- 10. support_requests
DROP POLICY IF EXISTS tenant_isolation_policy ON "support_requests";
CREATE POLICY tenant_isolation_policy ON "support_requests"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "support_requests"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN renter_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      ELSE TRUE
    END
  );

-- 11. notifications
DROP POLICY IF EXISTS tenant_isolation_policy ON "notifications";
CREATE POLICY tenant_isolation_policy ON "notifications"
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);

CREATE POLICY renter_restrictive_policy ON "notifications"
  AS RESTRICTIVE FOR ALL TO app_user
  USING (
    CASE
      WHEN current_setting('app.current_role', true) = 'RENTER'
        THEN user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      ELSE TRUE
    END
  );
