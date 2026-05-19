-- Playbook migration (DB-only, schema already applied)
-- This migration was applied to the database but the migration file was lost
-- No-op migration to sync local and DB history

BEGIN;
-- No changes needed — playbook fields already exist in DB
COMMIT;
