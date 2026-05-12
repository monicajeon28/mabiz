# Validation & Zod Schema Matrix

Complete validation strategy and Zod schema mapping for all database models.

## Schema Coverage Summary

| Domain | Model Count | Zod Schemas | Coverage |
|--------|------------|-----------|----------|
| Payment | 3 | 1 | 33% |
| Trial | 3 | 2 | 67% |
| Diary | 1 | 1 | 100% |
| ProductImage | 2 | 1 | 50% |
| Affiliate | 3 | 1 | 33% |
| Automation | 1 | 1 | 100% |
| Scheduling | 1 | 1 | 100% |
| Trip | 1 | 1 | 100% |
| Other | 22 | 5 | 23% |
| **Total** | **38** | **14** | **37%** |

---

## Zod Schema Details

### 1. Payment Schema
**File:** `schemas/paymentSchema.ts`  
**Purpose:** Validate payment creation and updates

**Validation Rules:**
```typescript
paymentSchema = z.object({
  orderId: z.string().min(5).max(50).describe('Payment order ID'),
  amount: z.number().int().positive().describe('Amount in KRW'),
  buyerName: z.string().min(2).max(100).describe('Buyer name'),
  buyerEmail: z.string().email().describe('Buyer email'),
  buyerTel: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/).describe('Korean phone'),
  paymentMethod: z.enum(['card', 'bank', 'vbank', 'kakao']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
});
```

**Models Covered:**
- ✓ Payment (create/update)
- ⚠️ PaymentRefund (partial)
- ⚠️ PayAppPayment (partial)

**Rules:**
- Order ID: 5-50 chars, unique across system
- Amount: > 0 KRW (no negative amounts)
- Email: Valid format
- Phone: Korean format (01X-XXX(X)-XXXX)

---

### 2. Trial Schema
**File:** `schemas/trialSchema.ts`  
**Purpose:** Validate trial account creation

**Validation Rules:**
```typescript
trialSchema = z.object({
  userId: z.number().int().positive(),
  code: z.string().length(8).regex(/^[A-Z0-9]+$/),
  startDate: z.date().default(() => new Date()),
  endDate: z.date(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).default('ACTIVE'),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});
```

**Models Covered:**
- ✓ Trial (create/update)
- ⚠️ TrialSignup (signup only)
- ⚠️ TrialAuditLog (auto-generated)

**Rules:**
- Trial code: 8 uppercase alphanumeric (e.g., "ABC12XYZ")
- End date: Must be after start date
- Duration: Typically 3 days
- One trial per user (userId unique)

---

### 3. Trial Admin Schema
**File:** `schemas/trialAdminSchema.ts`  
**Purpose:** Admin validation for trial management

**Validation Rules:**
```typescript
trialAdminSchema = z.object({
  action: z.enum(['activate', 'extend', 'cancel']),
  trialId: z.number().int().positive(),
  extendDays: z.number().int().min(1).max(30).optional(),
  reason: z.string().max(500).optional(),
  adminNotes: z.string().max(1000).optional(),
});
```

**Access Control:**
- Admin only (role = 'admin')
- Cannot modify expired trials
- Audit trail required

---

### 4. Diary Schema
**File:** `schemas/diarySchema.ts`  
**Purpose:** Validate diary entry creation

**Validation Rules:**
```typescript
diarySchema = z.object({
  title: z.string().min(1).max(200).describe('Diary title'),
  content: z.string().min(1).max(5000).describe('Diary content'),
  mood: z.enum(['happy', 'sad', 'neutral', 'excited']).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  isPublic: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
});
```

**Rules:**
- Title: 1-200 chars
- Content: 1-5000 chars
- Max 10 photos per entry
- Max 10 tags per entry
- Private by default

---

### 5. Expense Schema
**File:** `schemas/expenseSchema.ts`  
**Purpose:** Validate expense tracking

**Validation Rules:**
```typescript
expenseSchema = z.object({
  userId: z.number().int().positive(),
  category: z.enum(['accommodation', 'dining', 'transport', 'entertainment', 'other']),
  amount: z.number().positive().describe('Amount in currency'),
  currency: z.string().length(3).default('KRW'),
  description: z.string().max(500).optional(),
  date: z.date(),
  receipt: z.object({
    url: z.string().url().optional(),
    fileName: z.string().optional(),
  }).optional(),
});
```

**Rules:**
- Amount > 0
- Supported currencies: KRW, USD, EUR, JPY
- Receipt optional but recommended
- Category required

---

### 6. Product Image Schema
**File:** `schemas/productImageSchema.ts`  
**Purpose:** Validate image uploads

**Validation Rules:**
```typescript
productImageSchema = z.object({
  productId: z.number().int().positive(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  size: z.number().int().positive().max(10485760), // 10MB max
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
```

**Rules:**
- Max 10MB file size
- Supported formats: JPEG, PNG, GIF, WebP
- Width/height (optional but recommended)
- Position auto-assigns if not specified
- Validates image bytes (magic numbers)

---

### 7. Affiliate Schema
**File:** `schemas/affiliateSchema.ts`  
**Purpose:** Validate affiliate registration

**Validation Rules:**
```typescript
affiliateSchema = z.object({
  userId: z.number().int().positive(),
  companyName: z.string().min(2).max(100),
  businessNumber: z.string().regex(/^\d{3}-\d{2}-\d{5}$/),
  bankName: z.string().min(2).max(30),
  bankAccount: z.string().min(8).max(30),
  commissionRate: z.number().min(0).max(10),
  contact: z.object({
    phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/),
    email: z.string().email(),
    address: z.string().max(200),
  }),
});
```

**Rules:**
- Company name: 2-100 chars
- Business number: Korean format (XXX-XX-XXXXX)
- Commission rate: 0-10% (precision: 3 decimals)
- Phone: Korean format
- Email: Valid format
- Address: Max 200 chars

---

### 8. Affiliate Login Schema
**File:** `schemas/affiliateLoginSchema.ts`  
**Purpose:** Validate affiliate login

**Validation Rules:**
```typescript
affiliateLoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  rememberMe: z.boolean().optional().default(false),
});
```

**Rules:**
- Username: 3-50 chars (email or custom username)
- Password: 8-100 chars (bcrypt hashed)
- Remember me: Optional, default false

---

### 9. Admin Control Schema
**File:** `schemas/admin-control-schema.ts`  
**Purpose:** Admin action validation

**Validation Rules:**
```typescript
adminControlSchema = z.object({
  action: z.enum(['suspend', 'activate', 'verify', 'review', 'approve']),
  targetId: z.number().int().positive(),
  targetType: z.enum(['user', 'affiliate', 'payment', 'inquiry']),
  reason: z.string().max(500),
  notes: z.string().max(1000).optional(),
  attachments: z.array(z.string().url()).optional(),
});
```

**Access Control:**
- Admin only
- Reason required for suspension
- All actions audited

---

### 10. Admin Message Schema
**File:** `schemas/admin-message-schema.ts`  
**Purpose:** Admin-to-user messaging

**Validation Rules:**
```typescript
adminMessageSchema = z.object({
  adminId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  messageType: z.enum(['info', 'warning', 'urgent', 'announcement']),
  sendAt: z.date().optional(),
  recipients: z.enum(['all', 'specific', 'segment']),
});
```

**Rules:**
- Title: 1-200 chars
- Content: 1-5000 chars
- Can schedule for later send
- Support segments (VIP, new users, etc)

---

### 11. Automation Log Schema
**File:** `schemas/automation-log-schema.ts`  
**Purpose:** Track automated system actions

**Validation Rules:**
```typescript
automationLogSchema = z.object({
  userId: z.number().int().positive().optional(),
  actionType: z.enum([
    'passport-reminder',
    'trial-expiry-warning',
    'payment-reminder',
    'auto-cancel',
    'settlement-summary',
  ]),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']),
  result: z.string().max(500).optional(),
  errorMessage: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
  executedAt: z.date().optional(),
});
```

**Action Types:**
- `passport-reminder`: SMS/Email passport form
- `trial-expiry-warning`: 1-day before expiry
- `payment-reminder`: Overdue payment notice
- `auto-cancel`: Expired booking cancellation
- `settlement-summary`: Monthly affiliate settlement

---

### 12. Notification Schema
**File:** `schemas/notification-schema.ts`  
**Purpose:** User notification validation

**Validation Rules:**
```typescript
notificationSchema = z.object({
  userId: z.number().int().positive().optional(),
  type: z.enum(['payment', 'passport', 'booking', 'trial', 'message']),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  actionUrl: z.string().url().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  channels: z.array(z.enum(['push', 'email', 'sms', 'kakao'])),
  scheduledAt: z.date().optional(),
});
```

**Channels:**
- Push: Mobile/web push notification
- Email: Email delivery
- SMS: SMS message
- Kakao: Kakao Talk message

---

### 13. Schedule Schema
**File:** `schemas/scheduleSchema.ts`  
**Purpose:** Validate event scheduling

**Validation Rules:**
```typescript
scheduleSchema = z.object({
  userId: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startTime: z.date(),
  endTime: z.date(),
  location: z.string().max(200).optional(),
  attendees: z.array(z.number().int().positive()).optional(),
  reminder: z.enum(['15min', '1hour', '1day', 'none']).optional(),
  isPublic: z.boolean().default(false),
}).refine((data) => data.endTime > data.startTime, {
  message: 'End time must be after start time',
});
```

**Rules:**
- Start/end time: Valid interval
- Attendees: 0 or more
- Reminders: 15min, 1hour, 1day before
- Private by default

---

### 14. Trip Schema
**File:** `schemas/tripSchema.ts`  
**Purpose:** Validate trip planning

**Validation Rules:**
```typescript
tripSchema = z.object({
  userId: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startDate: z.date(),
  endDate: z.date(),
  destination: z.string().max(100),
  budget: z.number().positive().optional(),
  participants: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    role: z.enum(['organizer', 'participant']),
  })).optional(),
  itinerary: z.array(z.object({
    day: z.number().int().min(1),
    title: z.string(),
    activities: z.array(z.string()),
  })).optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
});
```

**Rules:**
- Duration: startDate to endDate
- Budget: Optional, if specified > 0
- Participants: 1+ (organizer + optional)
- Itinerary: Days numbered sequentially

---

## Validation Matrix by Model

### Full Coverage (100%)

| Model | Schema | Fields | Coverage |
|-------|--------|--------|----------|
| Trial | trialSchema | 6/6 | 100% |
| Diary | diarySchema | 7/7 | 100% |
| AutomationLog | automationLogSchema | 8/8 | 100% |
| Schedule | scheduleSchema | 8/8 | 100% |
| Trip | tripSchema | 8/8 | 100% |

### Partial Coverage (50-75%)

| Model | Schema | Fields | Coverage |
|-------|--------|--------|----------|
| Payment | paymentSchema | 6/8 | 75% |
| ProductImage | productImageSchema | 8/12 | 67% |
| Expense | expenseSchema | 6/6 | 100% |
| Affiliate | affiliateSchema | 6/7 | 86% |

### Minimal Coverage (<50%)

| Model | Schema | Fields | Coverage |
|-------|--------|--------|----------|
| Reservation | None | 0/11 | 0% |
| Traveler | None | 0/11 | 0% |
| ProductInquiry | None | 0/10 | 0% |
| PassportSubmission | None | 0/8 | 0% |
| TravelContract | None | 0/8 | 0% |

---

## Recommended Additional Schemas

### High Priority (Critical)

1. **ReservationSchema**
   - Fields: tripId, mainUserId, totalPeople, status
   - Purpose: Booking validation
   - Estimated lines: 20-30

2. **PassportSubmissionSchema**
   - Fields: userId, token, status
   - Purpose: Secure token validation + expiry
   - Estimated lines: 25-35

3. **ProductInquirySchema**
   - Fields: name, phone, email, message
   - Purpose: Contact form validation
   - Estimated lines: 15-25

### Medium Priority

4. **TravelerSchema**
   - Fields: name, phone, email, engSurname/engGivenName, birthDate
   - Estimated lines: 20-30

5. **TravelContractSchema**
   - Fields: reservationId, status, content
   - Estimated lines: 15-20

### Low Priority (Optional)

6. **ChatBotFlowSchema**
   - Estimated lines: 25-40

7. **PaymentRefundSchema**
   - Estimated lines: 15-20

---

## API Validation Example

### Payment Creation Endpoint

```typescript
import { paymentSchema } from '@/lib/schemas/paymentSchema';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate against Zod schema
    const result = paymentSchema.safeParse(body);
    
    if (!result.success) {
      return Response.json(
        { 
          error: 'Validation failed',
          details: result.error.flatten()
        },
        { status: 400 }
      );
    }

    // Use validated data with full type safety
    const payment = await prisma.payment.create({
      data: {
        orderId: result.data.orderId,
        amount: result.data.amount,
        buyerName: result.data.buyerName,
        buyerEmail: encryptEmail(result.data.buyerEmail),
        buyerTel: encryptPhone(result.data.buyerTel),
        status: 'PENDING',
      },
    });

    return Response.json(payment);
  } catch (error) {
    logger.error('Payment creation error', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Validation Best Practices

### DO's ✓

1. **Always validate input with Zod**
   ```typescript
   const result = schema.safeParse(data);
   if (!result.success) return error;
   ```

2. **Use refine() for cross-field validation**
   ```typescript
   .refine((data) => data.endDate > data.startDate)
   ```

3. **Provide clear error messages**
   ```typescript
   .describe('End date must be after start date')
   ```

4. **Define constraints explicitly**
   ```typescript
   z.string().min(5).max(50).email()
   ```

5. **Use enums for fixed values**
   ```typescript
   z.enum(['PENDING', 'COMPLETED', 'FAILED'])
   ```

### DON'Ts ✗

1. **Don't trust frontend validation alone**
   - Always validate on backend
   - Frontend is user-controlled

2. **Don't skip validation for "trusted" sources**
   - Validate all inputs equally
   - Include internal APIs

3. **Don't expose validation rules in errors**
   ```typescript
   // Bad: Reveals password requirements
   "Password must be 8+ chars with numbers"
   
   // Good: Generic message
   "Invalid password"
   ```

4. **Don't validate after using data**
   ```typescript
   // Bad
   const user = data.userId;
   const result = schema.safeParse(data);
   
   // Good
   const result = schema.safeParse(data);
   const user = result.data.userId;
   ```

---

## Testing Validation Schemas

### Unit Test Example

```typescript
import { paymentSchema } from '@/lib/schemas/paymentSchema';

describe('paymentSchema', () => {
  it('accepts valid payment', () => {
    const valid = {
      orderId: 'ORD-123456',
      amount: 100000,
      buyerName: 'John Doe',
      buyerEmail: 'john@example.com',
      buyerTel: '010-1234-5678',
    };
    
    const result = paymentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const invalid = {
      orderId: 'ORD-123456',
      amount: 100000,
      buyerName: 'John Doe',
      buyerEmail: 'invalid-email',
      buyerTel: '010-1234-5678',
    };
    
    const result = paymentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const invalid = {
      orderId: 'ORD-123456',
      amount: -100,
      buyerName: 'John Doe',
      buyerEmail: 'john@example.com',
      buyerTel: '010-1234-5678',
    };
    
    const result = paymentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
```

---

## Coverage Roadmap

### Current (14 schemas, 37% coverage)
- ✓ Core payment/trial/diary
- ✓ Affiliate/automation basics

### Phase 1 (Add 5 schemas, 50% coverage)
- ReservationSchema (critical)
- PassportSubmissionSchema (security)
- ProductInquirySchema (customer service)
- TravelerSchema (booking)
- TravelContractSchema (legal)

### Phase 2 (Add 3 schemas, 60% coverage)
- ChatBotFlowSchema
- PaymentRefundSchema
- ProductImageUploadSchema

### Phase 3 (Add 5+ schemas, 75%+ coverage)
- Comprehensive coverage of all user-facing models

---

**Last Updated:** 2026-05-11  
**Current Schemas:** 14  
**Coverage:** 37% (14/38 models)  
**Recommended Additions:** 5  
**Target Coverage:** 75%+ by Q3 2026
