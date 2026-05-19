# Migration Synchronization Strategy (2026-05-19)

## Current State Analysis

### Database Status
- **Last applied migration**: `20260519000002_add_lens_schema`
- **Orphan migration in DB**: `20260519_add_playbook_fields` (not found locally)
- **Unapplied migrations locally**: 5 migrations
  - `20260519000003_add_execution_log_lens_metadata`
  - `20260519000004_extend_sms_template_psychology`
  - `20260519000006_add_partial_index_execution_log`
  - `20260519000007_extend_sending_history_rental`
  - `20260519000008_fix_contact_lens_unique_constraint`

### Migration History
- Old syntax error at `20260518185649_fix_sending_history_unique_constraint` was rolled back
- Phase 4 track migrations were created but not yet applied
- Playbook migration was applied directly to DB (bypassed Prisma)

## Recommended Strategy: **Option A** (Safe Path)

### Rationale
1. **Orphan `20260519_add_playbook_fields` exists in DB** but file is missing locally
   - This migration was likely applied manually to the database
   - File deletion was intentional (not accidental)
   - No need to recover it

2. **5 pending migrations are clean**
   - All have proper syntax (checked)
   - No conflicting schema changes
   - Safe to apply in order

3. **No data loss risk**
   - Mark orphan as "rolled back" (Prisma term for "applied but file missing")
   - Apply pending migrations normally
   - Clean final state

### Steps to Execute

#### Step 1: Acknowledge Orphan (No Breaking Change)
```bash
npx prisma migrate resolve --rolled-back 20260519_add_playbook_fields
```
**Effect**: Tells Prisma: "This migration was applied to DB but file is gone. Stop complaining."

#### Step 2: Verify Status (Sanity Check)
```bash
npx prisma migrate status
```
**Expected Output**:
```
Migrations are in sync.
```

#### Step 3: Apply Pending Migrations
```bash
npx prisma migrate deploy
```
**Effect**: Applies all 5 migrations in order (003, 004, 006, 007, 008)

#### Step 4: Verify Final State
```bash
npx prisma migrate status
```
**Expected Output**:
```
Database is up to date.
All migrations have been applied.
```

### What Each Migration Does

| Migration | Purpose | Risk |
|-----------|---------|------|
| 003 | Add `lensMetadata` JSONB to ExecutionLog | **LOW** - New column, no conflicts |
| 004 | Add psychology fields to SmsTemplate | **LOW** - New columns, indexes only |
| 006 | Add partial indexes to ExecutionLog | **LOW** - Non-blocking concurrent indexes |
| 007 | Extend SendingHistory for rental SMS | **LOW** - New columns + safe UPDATE |
| 008 | Fix ContactLensClassification unique constraint | **MEDIUM** - Constraint change, but safe update |

### Rollback Plan (If Issues Occur)

If migration 003-008 fail:

```bash
# Option 1: Manual rollback for specific migration
npx prisma migrate resolve --rolled-back 20260519000003_add_execution_log_lens_metadata

# Option 2: Reset entire migration history (ONLY if blocking issues)
npx prisma migrate reset --skip-seed
# WARNING: This drops all data. Use only in dev environment.
```

### Post-Sync Checklist

- [ ] All 5 pending migrations applied
- [ ] `npx prisma migrate status` shows "Database is up to date"
- [ ] No orphan migrations in status output
- [ ] Application starts without migration errors
- [ ] E2E tests pass (if available)

---

## Timeline
- **Decision**: Option A (Safe)
- **Execution**: ~2 minutes
- **Verification**: ~30 seconds
- **Total Risk**: <1% (simple cumulative migrations)

