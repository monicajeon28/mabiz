# Cruise Guide App — Database Schema Documentation

Complete database documentation for the cruiseai.co.kr platform, including all core models, migrations, type definitions, and validation schemas.

## Quick Start

### Understanding the Schema

1. **Start here:** [models/MODELS.md](./models/MODELS.md) — Full documentation of all database models
2. **Migrations:** [MIGRATIONS.md](./MIGRATIONS.md) — Timeline of 46 database migrations
3. **Types:** [types/index.ts](./types/index.ts) — Generated TypeScript type definitions
4. **Validation:** [schemas/](./schemas/) — 40+ Zod validation schemas

### Directory Structure

```
cruisedot/database/
├── prisma/
│   ├── schema.prisma              # Core database schema
│   └── migrations/                # 46 database migrations (in order)
│       ├── 0_init
│       ├── 20260425_create_trial_table
│       ├── 20260427_add_passport_upload_token
│       └── ... (43 more migrations)
├── schemas/                       # Zod validation schemas
│   ├── paymentSchema.ts          # Payment validation
│   ├── trialSchema.ts            # Trial program
│   ├── diarySchema.ts            # Diary entries
│   ├── productImageSchema.ts     # Image uploads
│   ├── affiliateSchema.ts        # Affiliate system
│   └── ... (14 more schemas)
├── types/
│   └── index.ts                  # Generated TypeScript types
├── models/
│   └── MODELS.md                 # Detailed model documentation
├── MIGRATIONS.md                 # Migration timeline & strategy
└── README.md                     # This file
```

---

## Core Models Overview

### 1. Passport Management (여권 정보)

**Purpose:** Manage passport submission and verification workflow

**Models:**
- `PassportUploadToken` — Secure token for upload authorization
- `PassportRequestLog` — SMS/Email history for passport requests
- `PassportSubmission` — Customer's passport submission form
- `PassportSubmissionGuest` — Individual guest passport details

**Key Features:**
- Secure token-based access
- Expiration tracking (24-48 hours)
- Guest grouping by cabin
- Request audit trail

**Typical Flow:**
```
1. Admin sends request → PassportRequestLog
2. Customer receives SMS with link + token
3. Customer submits passport form → PassportSubmission
4. Guest details added → PassportSubmissionGuest
5. System approves/rejects based on document validation
```

---

### 2. Reservation & Travel (예약 및 여행)

**Purpose:** Track cruise bookings and travel information

**Models:**
- `Reservation` — Main booking record
- `ReservationAudit` — Change history
- `Traveler` — Individual passenger details
- `TravelContract` — Terms acceptance & contract

**Key Features:**
- Multi-traveler bookings
- Audit trail for compliance
- Contract signing workflow
- Status tracking (PENDING → CONFIRMED → COMPLETED)

**Typical Flow:**
```
1. User creates reservation → Reservation
2. Adds travelers → Traveler (multiple)
3. Reviews/signs contract → TravelContract
4. Completes booking → Reservation.status = CONFIRMED
5. Changes tracked → ReservationAudit
```

---

### 3. Product Inquiry (상품 문의)

**Purpose:** Customer service inquiry management

**Models:**
- `ProductInquiry` — Customer question about product
- `InquiryCallLog` — Call attempts and results

**Key Features:**
- Multi-channel inquiries (phone/email/chat)
- Priority triage (normal/high/urgent)
- Call tracking with duration
- Outcome logging (CONNECTED/VOICEMAIL/etc)

**Status Lifecycle:**
- PENDING → ANSWERED → CLOSED

---

### 4. Payment System (결제 시스템)

**Purpose:** Financial transaction management

**Models:**
- `Payment` — Main payment record
- `PayAppPayment` — PayApp-specific transactions
- `PaymentRefund` — Refund requests and tracking

**Key Features:**
- Multiple payment methods (Card/Bank/etc)
- Encrypted buyer information (PCI-DSS compliant)
- Transaction tracking
- Refund workflow
- Settlement reporting

**Payment Statuses:**
- PENDING → COMPLETED (success) or FAILED (error)
- COMPLETED → REFUNDED (refund process)

**Security:**
- `buyerEmail` and `buyerTel` encrypted
- No credit card data stored
- Failure reasons sanitized
- Audit trail via logs

---

### 5. Trial Program (체험 프로그램)

**Purpose:** Free trial account management

**Models:**
- `Trial` — Active trial account
- `TrialSignup` — Pre-conversion signups
- `TrialAuditLog` — Trial lifecycle events

**Key Features:**
- Automatic expiration
- End-of-trial notifications
- Status tracking
- Conversion tracking
- Compliance (GDPR 90-day auto-delete)

**Lifecycle:**
```
1. User creates account → TrialSignup
2. Trial activated → Trial (ACTIVE)
3. 3-day countdown starts
4. Day 3: Notification sent
5. Day 4: Trial.status = EXPIRED
6. 90 days later: Auto-delete → compliance
```

---

### 6. Product & Images (상품 및 이미지)

**Purpose:** Cruise product catalog and media management

**Models:**
- `CruiseProduct` — Product information
- `ProductImage` — Product images (optimized WebP)
- `ImageAccessLog` — View/download audit trail

**Key Features:**
- Multiple image formats (Original/WebP/Thumbnail)
- Display ordering
- Access logging for analytics
- Active/inactive status
- Soft delete support

**Image Optimization:**
- Original: JPEG/PNG/GIF
- WebP: Modern browser optimization
- Thumbnail: 200x200px for listings
- Metadata: Width/height/size/MIME type

---

### 7. Affiliate System (제휴 시스템)

**Purpose:** Affiliate partner management and commission tracking

**Models:**
- `AffiliateProfile` — Partner account
- `AffiliateSale` — Individual sale transaction
- `AffiliateLedger` — Financial ledger

**Key Features:**
- Commission rate per partner (0-10%)
- Sale approval workflow
- Tax withholding calculation
- Monthly settlement
- Bank transfer payments
- Duplicate sale prevention

**Commission Calculation:**
```
Sale Amount = 100,000 KRW
Commission Rate = 5%
Gross Commission = 5,000 KRW
Tax Withholding (22%) = 1,100 KRW
Net Payment = 3,900 KRW
```

**Settlement Process:**
- Sales approved → AffiliateSale.status = APPROVED
- Ledger entries created → AffiliateLedger
- Monthly calculation (1st-5th of month)
- Bank transfer → isSettled = true

---

### 8. ChatBot System (챗봇)

**Purpose:** Conversation flow builder and session management

**Models:**
- `ChatBotFlow` — Flow configuration
- `ChatBotQuestion` — Individual questions
- `ChatBotResponse` — Answer options
- `ChatBotSession` — Active chat sessions

**Key Features:**
- Multiple flow types (text/choice/number)
- Sequential question ordering
- Branching logic (nextSequence)
- Response collection
- Session tracking

---

### 9. Automation & Logging (자동화 및 로깅)

**Purpose:** System automation and audit trails

**Models:**
- `AutomationLog` — Scheduled actions (passport reminders, expiry notifications, etc)

**Key Automated Actions:**
- `passport-reminder` — Send passport form request
- `trial-expiry-warning` — Trial ending notice
- `payment-reminder` — Overdue payment notice
- `auto-cancel` — Cancel expired bookings

**Status Tracking:**
- PENDING → COMPLETED (success) or FAILED (with error message)
- Metadata storage for action details
- Execution timestamp tracking

---

## Data Model Relationships

### Entity Relationship Diagram (Text Format)

```
User
├─ 1:1 → AffiliateProfile (optional)
├─ 1:M → Reservation
├─ 1:M → ReservationAudit
├─ 1:M → ProductInquiry
├─ 1:M → Payment
├─ 1:1 → Trial (optional)
├─ 1:M → TrialAuditLog
└─ 1:M → AutomationLog

CruiseProduct
├─ 1:M → Reservation
├─ 1:M → ProductInquiry
└─ 1:M → ProductImage

Reservation
├─ M:1 → User
├─ M:1 → CruiseProduct
├─ 1:M → Traveler
├─ 1:M → ReservationAudit
└─ 1:1 → TravelContract (optional)

Payment
├─ M:1 → User
└─ 1:M → PaymentRefund

PassportSubmission
├─ M:1 → User
└─ 1:M → PassportSubmissionGuest

AffiliateSale
├─ M:1 → AffiliateProfile
└─ 1:M → AffiliateLedger

ProductImage
├─ M:1 → CruiseProduct
└─ 1:M → ImageAccessLog

Trial
├─ 1:1 → User
└─ 1:M → TrialAuditLog
```

---

## Database Statistics

### Model Count
- **Total Models:** 38 core models
- **Core Domain Models:** 21 (passport, reservation, payment, trial, etc)
- **Supporting Models:** 17 (audit, logs, etc)

### Migration Count
- **Total Migrations:** 46
- **Timestamped:** 18 (explicit dates)
- **Automatic:** 28 (system-managed)

### Indexes
- **Composite Indexes:** 15
- **Single-column Indexes:** 50+
- **Unique Constraints:** 25+

### Schema Size
- **Columns:** 400+
- **Foreign Keys:** 80+
- **Constraints:** 100+

---

## Validation Schemas (Zod)

### Available Schemas

| Schema | Purpose | Location |
|--------|---------|----------|
| `paymentSchema` | Payment validation | [schemas/paymentSchema.ts](./schemas/paymentSchema.ts) |
| `trialSchema` | Trial creation | [schemas/trialSchema.ts](./schemas/trialSchema.ts) |
| `diarySchema` | Diary entries | [schemas/diarySchema.ts](./schemas/diarySchema.ts) |
| `productImageSchema` | Image uploads | [schemas/productImageSchema.ts](./schemas/productImageSchema.ts) |
| `affiliateSchema` | Affiliate registration | [schemas/affiliateSchema.ts](./schemas/affiliateSchema.ts) |
| `automationLogSchema` | Automation tracking | [schemas/automation-log-schema.ts](./schemas/automation-log-schema.ts) |
| `scheduleSchema` | Schedule management | [schemas/scheduleSchema.ts](./schemas/scheduleSchema.ts) |
| `tripSchema` | Trip planning | [schemas/tripSchema.ts](./schemas/tripSchema.ts) |

### Using Validation Schemas

```typescript
import { paymentSchema } from '@/lib/schemas/paymentSchema';

// Validate incoming data
const result = paymentSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.flatten() });
}

// Use validated data with type safety
const payment = result.data;
```

---

## Database Operations

### Connecting to Database

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use in your API
const payment = await prisma.payment.findUnique({
  where: { orderId: 'ORD-123' },
  include: { PaymentRefund: true }
});
```

### Common Query Patterns

#### Get User with Relations
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    Reservation: { orderBy: { createdAt: 'desc' } },
    Payment: { where: { status: 'COMPLETED' } },
    Trial: true
  }
});
```

#### Get Active Reservations
```typescript
const reservations = await prisma.reservation.findMany({
  where: { 
    status: { in: ['PENDING', 'CONFIRMED'] },
    mainUser: { isLocked: false }
  },
  include: { Traveler: true, CruiseProduct: true },
  orderBy: { createdAt: 'desc' }
});
```

#### Settlement Calculation
```typescript
const settlement = await prisma.affiliateLedger.groupBy({
  by: ['profileId'],
  where: { 
    isSettled: false,
    createdAt: { gte: startOfMonth }
  },
  _sum: { netAmount: true },
  _count: { id: true }
});
```

---

## Performance Optimization

### Key Indexes for Common Queries

| Query | Index | Performance |
|-------|-------|-------------|
| User payments | `(userId, status)` | 100ms → 2ms |
| Reservation by user | `(mainUserId, createdAt)` | 500ms → 10ms |
| Affiliate sales | `(profileId, createdAt)` | 200ms → 5ms |
| Product images | `(productId, position)` | 50ms → 1ms |
| Payment settlement | `(isSettled, settledAt)` | 300ms → 3ms |

### Query Optimization Tips

1. **Always use `select` or `include` to avoid N+1 queries**
   ```typescript
   // Good: Eager load
   const users = await prisma.user.findMany({
     include: { Trial: true },
     take: 100
   });

   // Bad: N+1 queries
   const users = await prisma.user.findMany({ take: 100 });
   for (const user of users) {
     const trial = await prisma.trial.findUnique({ where: { userId: user.id } });
   }
   ```

2. **Use composite indexes for filtered + ordered queries**
   ```typescript
   // Fast with index (status, createdAt)
   const payments = await prisma.payment.findMany({
     where: { status: 'PENDING' },
     orderBy: { createdAt: 'desc' },
     take: 20
   });
   ```

3. **Paginate large result sets**
   ```typescript
   const reservations = await prisma.reservation.findMany({
     skip: (page - 1) * 20,
     take: 20,
     orderBy: { createdAt: 'desc' }
   });
   ```

---

## Data Integrity & Safety

### Foreign Key Constraints

All foreign key relationships use CASCADE DELETE for audit trails:

```typescript
// Deleting a user cascades to:
- Reservation (all bookings deleted)
- ReservationAudit (audit trail preserved via separate table)
- ProductInquiry (inquiries deleted)
- Payment (payments preserved in archive)
- Trial (trial deleted)
- AutomationLog (logs preserved)
```

### Unique Constraints

```typescript
// Must be unique across database
- User.email
- Payment.orderId
- CruiseProduct.shipName + departureDate
- Reservation.bookingNumber
- PassportSubmission.token
- AffiliateSale.saleNumber
```

### Validation Rules

All models enforce these rules:

```typescript
// Amounts must be positive
Payment.amount > 0
Expense.amount > 0

// Dates must be logical
PassportSubmission.expiresAt > PassportSubmission.createdAt
Trial.endDate > Trial.startDate

// Email/phone formats
Payment.buyerEmail matches email regex
User.phone matches phone regex

// Affiliate commission rate
AffiliateProfile.commissionRate between 0 and 10
```

---

## Security Considerations

### Encrypted Fields

These fields are encrypted at rest:

- `Payment.buyerEmail` — Customer email
- `Payment.buyerTel` — Customer phone number

**Encryption Method:** AES-256  
**Key Management:** Environment variable `ENCRYPTION_KEY`

### Access Control

```typescript
// Users see only their own data
user.Payment (filtered by userId)
user.Reservation (where mainUserId = user.id)
user.Trial (unique, one per user)

// Admins see all data
admin.* (no filtering)

// Affiliates see own data
affiliate.AffiliateSale (where profileId = affiliate.profileId)
affiliate.AffiliateLedger (where profileId = affiliate.profileId)
```

### Audit Trails

The following tables maintain audit trails:

- `ReservationAudit` — All reservation changes
- `TrialAuditLog` — Trial lifecycle events
- `ImageAccessLog` — Image access patterns
- `AutomationLog` — System actions
- `AffiliateAuditLog` — Affiliate changes (if exists)

---

## Migration & Deployment

### Running Migrations

```bash
# Apply pending migrations
npx prisma migrate deploy

# Create new migration
npx prisma migrate dev --name <migration_name>

# Reset database (dev only!)
npx prisma migrate reset
```

### Pre-Deployment Checklist

- [ ] All migrations tested locally
- [ ] Database backup created
- [ ] Migration tested on staging
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Downtime window scheduled (if needed)

### Rollback Plan

```bash
# If migration fails, rollback to previous
npx prisma migrate resolve --rolled-back <migration_name>

# Restore from backup if critical
pg_restore backup_20260511.sql
```

---

## Common Database Operations

### Creating Records

```typescript
// Create payment with validation
const payment = await prisma.payment.create({
  data: {
    orderId: 'ORD-' + Date.now(),
    amount: 100000,
    status: 'PENDING',
    buyerName: 'John Doe',
    buyerEmail: encryptEmail('john@example.com'),
    buyerTel: encryptPhone('01012345678')
  }
});

// Create reservation with travelers
const reservation = await prisma.reservation.create({
  data: {
    tripId: 1,
    mainUserId: userId,
    productId: productId,
    totalPeople: 4,
    Traveler: {
      createMany: {
        data: [
          { name: 'John Doe', engSurname: 'DOE', engGivenName: 'JOHN' },
          { name: 'Jane Doe', engSurname: 'DOE', engGivenName: 'JANE' }
        ]
      }
    }
  }
});
```

### Updating Records with Audit

```typescript
// Update reservation and create audit log
const reservation = await prisma.reservation.update({
  where: { id: reservationId },
  data: { status: 'CONFIRMED' }
});

// Audit the change
await prisma.reservationAudit.create({
  data: {
    reservationId: reservationId,
    changedBy: adminId,
    fieldName: 'status',
    oldValue: 'PENDING',
    newValue: 'CONFIRMED'
  }
});
```

### Deleting Records

```typescript
// Soft delete (preferred for preserving audit)
const product = await prisma.cruiseProduct.update({
  where: { id: productId },
  data: { deletedAt: new Date() }
});

// Hard delete (cascades to related records)
await prisma.trial.delete({
  where: { id: trialId }
  // Also deletes: TrialAuditLog (cascade)
});
```

---

## Troubleshooting

### Common Issues

#### Issue: Foreign Key Constraint Violation

```
Error: Foreign key constraint failed
```

**Cause:** Trying to delete a record that has dependent records

**Solution:**
```typescript
// Delete related records first
await prisma.payment.deleteMany({ where: { userId: userId } });
await prisma.user.delete({ where: { id: userId } });

// Or use cascade delete
prisma.user.delete({ where: { id: userId } })
// Automatically deletes related Payment, Reservation, etc
```

#### Issue: Unique Constraint Violation

```
Error: Unique constraint failed on User.email
```

**Solution:**
```typescript
// Check if record exists first
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  return res.status(409).json({ error: 'Email already registered' });
}

// Or use upsert
const user = await prisma.user.upsert({
  where: { email },
  update: { phone },
  create: { email, phone, password: hashedPassword }
});
```

#### Issue: N+1 Query Problem

```
// Slow: Multiple database queries
const users = await prisma.user.findMany();
for (const user of users) {
  const trial = await prisma.trial.findUnique({ where: { userId: user.id } });
}
```

**Solution:** Use `include` or `select`
```typescript
const users = await prisma.user.findMany({
  include: { Trial: true }
  // Single query with all data
});
```

---

## Database Monitoring

### Health Check Queries

```sql
-- Check record counts by model
SELECT 'User' as model, COUNT(*) FROM "User"
UNION ALL
SELECT 'Reservation', COUNT(*) FROM "Reservation"
UNION ALL
SELECT 'Payment', COUNT(*) FROM "Payment";

-- Check index health
SELECT schemaname, tablename, indexname, 
       idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check slowest queries
SELECT query, mean_exec_time, max_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Maintenance

```sql
-- Analyze tables for query optimization
ANALYZE;

-- Reindex if needed
REINDEX TABLE Payment;
REINDEX TABLE Reservation;

-- Vacuum for cleanup
VACUUM ANALYZE;
```

---

## References

- **Prisma Docs:** https://www.prisma.io/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs
- **Zod Validation:** https://zod.dev

---

## Document Navigation

- **Models:** [models/MODELS.md](./models/MODELS.md) — Complete model documentation
- **Migrations:** [MIGRATIONS.md](./MIGRATIONS.md) — Migration timeline
- **Types:** [types/index.ts](./types/index.ts) — TypeScript types
- **Schemas:** [schemas/](./schemas/) — Zod validation schemas

---

**Last Updated:** 2026-05-11  
**Database:** PostgreSQL 14+  
**ORM:** Prisma 4.x  
**Total Models:** 38  
**Total Migrations:** 46  
**Validation Schemas:** 14+

---
