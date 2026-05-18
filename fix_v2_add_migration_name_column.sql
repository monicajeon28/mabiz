-- ==============================================================================
-- FIX V2: ADD migration_name COLUMN (Backward Compatibility)
-- ==============================================================================
-- Problem: Prisma schema-engine expects "migration_name" column
-- Current DB has: "name" column (Prisma v7+ format)
-- Solution: Add "migration_name" as alias/computed column or copy from "name"
-- ==============================================================================

-- STEP 1: Check if migration_name already exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = '_prisma_migrations' AND column_name = 'migration_name';

-- STEP 2: Add migration_name column (if not exists)
ALTER TABLE _prisma_migrations ADD COLUMN migration_name VARCHAR(255);

-- STEP 3: Populate from name column
UPDATE _prisma_migrations SET migration_name = name WHERE migration_name IS NULL;

-- STEP 4: Make NOT NULL and add UNIQUE constraint
ALTER TABLE _prisma_migrations ALTER COLUMN migration_name SET NOT NULL;
ALTER TABLE _prisma_migrations ADD CONSTRAINT _prisma_migrations_migration_name_unique UNIQUE(migration_name);

-- STEP 5: Verify
SELECT column_name FROM information_schema.columns 
WHERE table_name = '_prisma_migrations' AND column_name IN ('name', 'migration_name');
