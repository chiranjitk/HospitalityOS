-- Migration: Add columns that were added to Prisma schema but not yet in DB
-- Date: 2026-05-28
-- Issue: RoomType.bedType / bedCount and InventoryLock.maintenanceBlockId
--        were added to schema but prisma db push wasn't run, causing 500 errors
--
-- Must be run as table owner (postgres superuser via local socket):
--   psql -h /tmp -U postgres -d staysuite -f scripts/migrations/add-missing-columns.sql
-- Or via md5 auth:
--   PGPASSWORD="Staysuite2025" psql -h ::1 -U staysuite -d staysuite -f scripts/migrations/add-missing-columns.sql

BEGIN;

-- 1. InventoryLock.maintenanceBlockId (FK to MaintenanceBlock for bidirectional sync)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InventoryLock' AND column_name = 'maintenanceBlockId'
  ) THEN
    ALTER TABLE "InventoryLock" ADD COLUMN "maintenanceBlockId" UUID;
    CREATE INDEX IF NOT EXISTS "InventoryLock_maintenanceBlockId_idx"
      ON "InventoryLock"("maintenanceBlockId");
    RAISE NOTICE 'Added InventoryLock.maintenanceBlockId';
  ELSE
    RAISE NOTICE 'InventoryLock.maintenanceBlockId already exists';
  END IF;
END
$$;

-- 2. RoomType.bedType (bed configuration: king/queen/twin/sofa etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'RoomType' AND column_name = 'bedType'
  ) THEN
    ALTER TABLE "RoomType" ADD COLUMN "bedType" TEXT NOT NULL DEFAULT 'standard';
    RAISE NOTICE 'Added RoomType.bedType';
  ELSE
    RAISE NOTICE 'RoomType.bedType already exists';
  END IF;
END
$$;

-- 3. RoomType.bedCount (number of beds)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'RoomType' AND column_name = 'bedCount'
  ) THEN
    ALTER TABLE "RoomType" ADD COLUMN "bedCount" INT NOT NULL DEFAULT 1;
    RAISE NOTICE 'Added RoomType.bedCount';
  ELSE
    RAISE NOTICE 'RoomType.bedCount already exists';
  END IF;
END
$$;

COMMIT;

-- Verify
SELECT 'Verification:' AS info;
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('InventoryLock', 'RoomType')
  AND column_name IN ('maintenanceBlockId', 'bedType', 'bedCount')
ORDER BY table_name, column_name;
