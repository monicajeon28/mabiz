-- ==============================================================================
-- PRISMA v7.7.0 MIGRATIONS TABLE REPAIR
-- ==============================================================================
-- Problem: _prisma_migrations table uses old schema (missing "migration_name" col)
-- Expected: Column should be named "name", not "migration_name"
-- Root Cause: Schema definition mismatch between Prisma expectation and current DB
--
-- Solution: Recreate _prisma_migrations with correct schema
-- ==============================================================================

-- STEP 1: Backup existing data
CREATE TABLE _prisma_migrations_backup AS SELECT * FROM _prisma_migrations;

-- STEP 2: Drop old table with constraints
DROP TABLE IF EXISTS _prisma_migrations CASCADE;

-- STEP 3: Recreate with correct Prisma v7 schema
CREATE TABLE _prisma_migrations (
    id SERIAL PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMP,
    execution_time BIGINT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logs TEXT,
    rolled_back_at TIMESTAMP,
    started_by VARCHAR(255),
    finished_by VARCHAR(255),
    name VARCHAR(255) NOT NULL UNIQUE
);

-- STEP 4: Restore data from backup
INSERT INTO _prisma_migrations (id, checksum, finished_at, execution_time, success, started_at, logs, rolled_back_at, started_by, finished_by, name)
SELECT id, checksum, finished_at, execution_time, success, started_at, logs, rolled_back_at, started_by, finished_by, name
FROM _prisma_migrations_backup
ORDER BY id;

-- STEP 5: Verify data integrity
SELECT 'Backup count:' as check_point, COUNT(*) FROM _prisma_migrations_backup
UNION ALL
SELECT 'Restored count:', COUNT(*) FROM _prisma_migrations;

-- STEP 6: Test column existence
SELECT column_name FROM information_schema.columns 
WHERE table_name = '_prisma_migrations' AND column_name = 'name';

-- STEP 7: Cleanup backup (run after verification)
-- DROP TABLE _prisma_migrations_backup;
