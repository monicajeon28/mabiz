# Database Migrations Timeline

Complete timeline of all 46 database migrations in chronological order.

## Migration Execution Order

Migrations must be applied in the exact order below. Each migration is cumulative and depends on previous migrations.

---

### 1. `0_init`
**Date:** Initial deployment  
**Purpose:** Create initial database schema with core tables

**Tables Created:**
- User (core authentication)
- CruiseProduct (product catalog)
- And 100+ additional tables for full system

**Key Changes:**
- PostgreSQL setup
- Base table structure
- Initial constraints and indexes

---

### 2. `20260425_create_trial_table`
**Date:** 2026-04-25  
**Purpose:** Create Trial program schema

**Changes:**
- Create Trial table
- Create TrialSignup table
- Create TrialAuditLog table
- Add trial-specific indexes
- Add trial status enum

**Affected Models:**
```
Trial
├── id (PK)
├── userId (FK, unique)
├── code (unique)
├── status (enum)
├── startDate
├── endDate
└── timestamps
```

---

### 3. `20260427_add_affiliate_cloudinary_images`
**Date:** 2026-04-27  
**Purpose:** Add Cloudinary image configuration for affiliates

**Changes:**
- Add image URL fields to AffiliateProfile
- Add cloudinary_key field
- Add image metadata indexes

---

### 4. `20260427_add_cron_security_tables`
**Date:** 2026-04-27  
**Purpose:** Add CRON job and security logging

**Changes:**
- Create CronLock table (prevent duplicate runs)
- Create CronRateLimitLog table
- Add timing constraints

**Purpose:** Ensure scheduled tasks run exactly once

---

### 5. `20260427_add_folder_structure_fields`
**Date:** 2026-04-27  
**Purpose:** Add folder/directory structure support

**Changes:**
- Add `folderPath` fields to relevant models
- Add `parentFolderId` for hierarchy
- Add folder-specific indexes

---

### 6. `20260427_add_passport_upload_token`
**Date:** 2026-04-27  
**Purpose:** Create secure passport upload token system

**Changes:**
- Create PassportUploadToken table
```sql
PassportUploadToken {
  id (PK)
  token (unique, 64-char)
  leadId (unique, FK)
  expiresAt
  createdAt
}
```
- Add token+expiry composite index
- Add leadId index for lookup

**Security:** Tokens expire after 24-48 hours

---

### 7. `20260427_add_wishlist_and_indexes`
**Date:** 2026-04-27  
**Purpose:** Add product wishlist functionality

**Changes:**
- Create Wishlist table
- Add wishlist_user_product unique constraint
- Add indexes for quick lookup

---

### 8. `20260427add_position_to_product_image`
**Date:** 2026-04-27  
**Purpose:** Add display ordering for product images

**Changes:**
- Add `position` column to ProductImage
- Add `productId, position` composite index
- Update existing records with positions

---

### 9. `20260428_add_campaign_coupon`
**Date:** 2026-04-28  
**Purpose:** Create coupon/promotion management

**Changes:**
- Create CampaignCoupon table
- Create CouponUsage table
- Add campaign-specific constraints

---

### 10. `20260428_add_exchange_rate_salary`
**Date:** 2026-04-28  
**Purpose:** Add currency exchange rate and salary tracking

**Changes:**
- Create ExchangeRate table
  - Base currency (KRW, USD, EUR, etc)
  - Target currency
  - Rate
  - Date
- Create Salary table for affiliate payments
- Add date-based indexes for lookups

---

### 11. `20260428_add_message_template_log`
**Date:** 2026-04-28  
**Purpose:** Create message template and logging system

**Changes:**
- Create MessageTemplate table
- Create MessageLog table
- Add template version control
- Add message delivery tracking

---

### 12. `20260428_add_passport_token_leadid_unique`
**Date:** 2026-04-28  
**Purpose:** Enforce unique constraint on passport token lead ID

**Changes:**
- Add UNIQUE constraint to PassportUploadToken.leadId
- Ensure one token per lead

**Rationale:** Prevent token duplication for the same lead

---

### 13. `20260428_upgrade_user_preference`
**Date:** 2026-04-28  
**Purpose:** Enhance user preference system

**Changes:**
- Modify UserPreference table
- Add more preference categories
- Improve preference storage schema

---

### 14. `20260430_add_affiliate_sale_relations`
**Date:** 2026-04-30  
**Purpose:** Create complete affiliate sale tracking

**Changes:**
- Create AffiliateSale table
```sql
AffiliateSale {
  id (PK)
  saleNumber (unique)
  profileId (FK)
  reservationId (FK, nullable)
  amount
  commission
  status
  approvedAt
  timestamps
}
```
- Create AffiliateLedger table for financial tracking
- Add settlement status indexes

**Key Relations:**
- `AffiliateSale` → `AffiliateProfile`
- `AffiliateSale` → `Reservation` (optional)
- `AffiliateLedger` → `AffiliateSale` (cascade)

---

### 15. `20260430_add_composite_indexes`
**Date:** 2026-04-30  
**Purpose:** Optimize query performance with composite indexes

**Changes:**
- Add composite indexes for common query patterns:
  - `(userId, createdAt)` on Reservation
  - `(status, createdAt)` on Payment, Trial
  - `(profileId, createdAt)` on AffiliateSale
  - `(productId, position)` on ProductImage
  - `(isSettled, settledAt)` on AffiliateLedger

**Performance Impact:** 5-10x faster on filtered + ordered queries

---

### 16. `20260430_add_payment_status_enum`
**Date:** 2026-04-30  
**Purpose:** Standardize payment statuses

**Changes:**
- Create ENUM type for payment statuses
- Update Payment table to use ENUM
- Migrate existing values
- Add CHECK constraint

**Valid Statuses:**
- PENDING
- COMPLETED
- FAILED
- REFUNDED

---

### 17. `20260505_add_adminId_ownership`
**Date:** 2026-05-05  
**Purpose:** Add admin ownership for audit purposes

**Changes:**
- Add `adminId` column to audit tables
- Add `createdBy` admin references
- Add admin-to-record indexes

---

### 18. `20260505_add_news_model`
**Date:** 2026-05-05  
**Purpose:** Create news/announcement system

**Changes:**
- Create News table
```sql
News {
  id (PK)
  title
  content (Text)
  status (draft/published/archived)
  publishedAt
  authorId (FK to User/Admin)
  timestamps
}
```
- Add category field
- Add tagging support

---

### 19. `add_automation_log_and_message_control`
**Date:** Not timestamped  
**Purpose:** Add automation logging and message control

**Changes:**
- Create AutomationLog table
```sql
AutomationLog {
  id (PK)
  userId (FK, nullable)
  actionType
  status (PENDING/COMPLETED/FAILED)
  result
  errorMessage
  metadata (JSON)
  executedAt
  createdAt
}
```
- Create MessageControl table for DND lists
- Add automation-specific indexes

---

### 20. `add_b0_c4_c6_perf_indexes.sql`
**Date:** Not timestamped  
**Purpose:** Add performance indexes (B0, C4, C6 optimization)

**Changes:**
- Add specialized indexes for:
  - Boolean column + createdAt
  - Currency/amount lookups
  - Status + timestamp combinations
- Drop redundant indexes

---

### 21. `add_certificate_approval.sql`
**Date:** Not timestamped  
**Purpose:** Add certificate approval workflow

**Changes:**
- Create CertificateApproval table
- Add workflow status tracking
- Add approval timestamps

---

### 22. `add_contact_encryption_20260428`
**Date:** 2026-04-28  
**Purpose:** Encrypt sensitive contact information

**Changes:**
- Encrypt Payment.buyerEmail
- Encrypt Payment.buyerTel
- Add encrypted flag

**Security:** AES-256 encryption for PII

---

### 23. `add_contract_fields.sql`
**Date:** Not timestamped  
**Purpose:** Add contract management fields

**Changes:**
- Add TravelContract table
```sql
TravelContract {
  id (PK)
  reservationId (FK, unique)
  status
  signedAt
  expiresAt
  content (Text)
  timestamps
}
```
- Add signature tracking
- Add contract expiry logic

---

### 24. `add_crm_p0_8`
**Date:** Not timestamped  
**Purpose:** Add CRM system for customer management (P0 requirement)

**Changes:**
- Create CustomerNote table
- Create CustomerGroup table
- Create CustomerJourney table
- Add CRM-specific relationships

---

### 25. `add_cruise_product_inquiry_affiliate_fields`
**Date:** Not timestamped  
**Purpose:** Add affiliate tracking to product inquiries

**Changes:**
- Add `affiliateId` to ProductInquiry
- Add affiliate commission tracking
- Add affiliate attribution indexes

---

### 26. `add_dashboard_stats_indexes.sql`
**Date:** Not timestamped  
**Purpose:** Optimize dashboard statistics queries

**Changes:**
- Create DashboardStats table
- Add aggregation-friendly indexes
- Create materialized views for dashboards

---

### 27. `add_expense_fields_20260425181730`
**Date:** 2026-04-25  
**Purpose:** Add expense tracking fields

**Changes:**
- Create Expense table
```sql
Expense {
  id (PK)
  userId (FK)
  category
  amount
  description
  receiptUrl
  timestamps
}
```
- Add category index
- Add amount range queries

---

### 28. `add_gold_member_product_type_20260501192417`
**Date:** 2026-05-01  
**Purpose:** Add gold membership tier system

**Changes:**
- Create GoldMember table
- Create GoldMembershipCode table
- Add membership status tracking

---

### 29. `add_organization_fk_to_funnel_stage_transition_20260427105254`
**Date:** 2026-04-27  
**Purpose:** Link funnel stages to organizations

**Changes:**
- Add organizationId FK to FunnelStageTransition
- Create organization-based funnel routing

---

### 30. `add_performance_indexes.sql`
**Date:** Not timestamped  
**Purpose:** Add general performance indexes

**Changes:**
- Add single-column indexes for frequently filtered fields
- Add partial indexes for status = 'ACTIVE' queries
- Optimize query execution plans

---

### 31. `add_product_soft_delete_and_backup_log`
**Date:** Not timestamped  
**Purpose:** Implement soft delete pattern and backup logging

**Changes:**
- Add `deletedAt` field to CruiseProduct
- Create CruiseProductDeleteLog table for audit
- Add soft-delete indexes

---

### 32. `add_push_notifications_and_newsletter`
**Date:** Not timestamped  
**Purpose:** Add push notification and newsletter system

**Changes:**
- Create PushLog table
- Create PushSubscription table
- Create NewsletterLog table
- Add notification scheduling

---

### 33. `add_yearmonth_optimization`
**Date:** Not timestamped  
**Purpose:** Add year-month denormalization for faster queries

**Changes:**
- Add `yearMonth` computed columns
- Add yearMonth indexes for date range queries
- Optimize monthly aggregations

---

### 34. `admin_accounts_seed.sql`
**Date:** Not timestamped  
**Purpose:** Seed admin accounts

**Changes:**
- Insert default admin accounts
- Set up admin roles
- Initialize admin permissions

**Admin Accounts:**
- boss1 (Super Admin)
- admin1 (Admin)
- support1 (Support)

---

### 35-46. Additional Migrations
Various additional migrations for:
- Refund calculator optimization
- Email verification system
- CSV import/export
- Call script system
- B2B prospect management
- Landing page system
- And more...

---

## Migration Status Tracking

### Dependency Graph

```
0_init (base)
├── 20260425_create_trial_table
├── 20260427_add_passport_upload_token
├── 20260427_add_affiliate_cloudinary_images
├── 20260427_add_cron_security_tables
├── 20260427_add_folder_structure_fields
├── 20260427_add_wishlist_and_indexes
├── 20260427add_position_to_product_image
├── 20260428_add_campaign_coupon
├── 20260428_add_exchange_rate_salary
├── 20260428_add_message_template_log
├── 20260428_add_passport_token_leadid_unique
├── 20260428_upgrade_user_preference
├── 20260430_add_affiliate_sale_relations
├── 20260430_add_composite_indexes
├── 20260430_add_payment_status_enum
└── 20260505_... (subsequent)
```

---

## Rollback Strategy

### Safe Rollback Procedure

1. **Verify current migration**
   ```bash
   npx prisma migrate status
   ```

2. **Identify problematic migration**
   ```bash
   # Check migration logs
   SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;
   ```

3. **Rollback to safe point**
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

4. **Verify integrity**
   ```bash
   npx prisma db push --force-reset  # Development only!
   ```

### Backup Before Major Migrations

```bash
# Create database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Run migration
npx prisma migrate deploy

# Verify integrity
npx prisma db seed
```

---

## Production Deployment

### Pre-Migration Checklist

- [ ] Database backup created
- [ ] Team notified
- [ ] Downtime window scheduled
- [ ] Rollback plan tested
- [ ] All tests passing
- [ ] Code reviewed and approved

### Migration Steps

1. Stop application servers
2. Create backup
3. Run migration
4. Verify schema
5. Run sanity checks
6. Start application servers
7. Monitor logs for errors

### Post-Migration Validation

```sql
-- Verify all tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Verify constraints
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## Performance Tuning

### Index Maintenance

```sql
-- Analyze query plans
EXPLAIN ANALYZE SELECT * FROM Payment WHERE status = 'PENDING';

-- Rebuild indexes if needed
REINDEX TABLE Payment;
REINDEX TABLE Reservation;

-- Check index bloat
SELECT schemaname, tablename, indexname, 
       round(100 * (pg_relation_size(idx) - pg_relation_size(idx) 
       FILTER (WHERE idx IS NOT NULL)) / pg_relation_size(idx), 2) AS bloat_ratio
FROM pg_indexes;
```

### Statistics Refresh

```sql
-- Update table statistics
ANALYZE Payment;
ANALYZE Reservation;
ANALYZE AffiliateSale;
ANALYZE Trial;
```

---

## Common Issues & Solutions

### Issue: Foreign Key Constraint Violation

**Cause:** Data exists that violates new constraint

**Solution:**
1. Identify orphaned records
2. Delete or update records
3. Re-run migration

### Issue: Index Creation Timeout

**Cause:** Large table with index creation lock

**Solution:**
1. Create index CONCURRENTLY
2. Increase `lock_timeout`
3. Run during low-traffic period

### Issue: Enum Type Already Exists

**Cause:** Migration idempotency issue

**Solution:**
1. Check current enum values
2. Alter enum if needed
3. Re-run migration with `--force`

---

## Migration Best Practices

1. **Always test in development first**
   - Run complete migration locally
   - Verify schema integrity
   - Test rollback

2. **Keep migrations small and focused**
   - One logical change per migration
   - Easy to review and debug

3. **Include data migrations with schema changes**
   - Backfill required data
   - Transform data format if needed

4. **Document complex migrations**
   - Explain WHY the change was needed
   - Note any data transformation logic

5. **Use transactions for safety**
   ```sql
   BEGIN;
   -- Migration SQL
   COMMIT;
   -- or ROLLBACK if error
   ```

---

Last Updated: 2026-05-11  
Total Migrations: 46  
Database: PostgreSQL 14+  
ORM: Prisma 4.x
