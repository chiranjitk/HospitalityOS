-- ============================================================
-- PostgreSQL RLS (Row-Level Security) Template
-- StaySuite HospitalityOS - Tenant Data Isolation
-- ============================================================
--
-- INSTRUCTIONS FOR DBA:
-- 1. Review all table names below to ensure they match your schema
-- 2. Connect to the staysuite database as superuser
-- 3. Run each section sequentially
-- 4. Test with: SET app.tenant_id = '<tenant-uuid>'; SELECT * FROM "Guest" LIMIT 1;
-- 5. The application sets app.tenant_id via Prisma middleware or per-transaction
-- ============================================================

-- Step 1: Enable RLS on all tenant-scoped tables
-- Modify this list to match your actual schema tables that have a tenant_id column

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'tenantId'
      AND table_schema = 'public'
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
    RAISE NOTICE 'Enabled RLS on %', r.table_name;
  END LOOP;
END $$;

-- Step 2: Create tenant isolation policy template
-- This will be applied to all tables with tenantId column

CREATE OR REPLACE FUNCTION app_tenant_policy(tbl text)
RETURNS VOID AS $$
BEGIN
  -- Drop existing policies if they exist
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
  
  -- Create policy: only allow access to rows matching app.tenant_id
  EXECUTE format('
    CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid)
      WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid);
  ', tbl);
  
  RAISE NOTICE 'Created tenant_isolation policy on %', tbl;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Apply the policy to all tenant-scoped tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'tenantId'
      AND table_schema = 'public'
      AND table_type = 'BASE TABLE'
  LOOP
    PERFORM app_tenant_policy(r.table_name);
  END LOOP;
END $$;

-- Step 4: Function to set tenant context for a session/transaction
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid uuid)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_uuid::text, false);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Force tenant_id to be set before any query (optional safeguard)
-- WARNING: This is aggressive and may break some admin tooling
-- Uncomment only after thorough testing:

-- CREATE OR REPLACE FUNCTION enforce_tenant_context()
-- RETURNS VOID AS $$
-- BEGIN
--   IF current_setting('app.tenant_id', true) IS NULL THEN
--     RAISE EXCEPTION 'Tenant context (app.tenant_id) is not set. Use set_tenant_context(uuid).';
--   END IF;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- ALTER DATABASE staysuite SET app.enforce_tenant_context = on;

-- Step 6: (Optional) Create a trigger to auto-set tenant_id on INSERT
-- This ensures no row can be inserted without a tenant_id
-- Uncomment and modify per table as needed:

-- CREATE OR REPLACE FUNCTION enforce_tenant_on_insert()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW."tenantId" IS NULL THEN
--     NEW."tenantId" = current_setting('app.tenant_id', true)::uuid;
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trg_tenant_insert BEFORE INSERT ON "Guest"
--   FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check which tables have RLS enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies on a specific table:
-- SELECT policyname, tablename, cmd, qual, with_check 
-- FROM pg_policies WHERE schemaname = 'public' AND tablename = 'Guest';

-- Test tenant isolation:
-- SELECT set_tenant_context('<uuid>');
-- SELECT count(*) FROM "Guest";  -- Should only show this tenant's guests
