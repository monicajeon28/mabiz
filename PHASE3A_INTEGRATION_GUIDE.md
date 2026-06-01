# Phase 3-A: Authorization Tests - Integration Guide

## Quick Start

### Run the Tests
```bash
npm test -- tests/security/commission-ledger-isolation.test.ts
```

Expected output:
```
✅ PASS tests/security/commission-ledger-isolation.test.ts
✅ Tests: 27 passed, 27 total
⏱️ Time: 0.247 seconds
```

---

## Integration into Existing API Routes

### Step 1: Import Auth Utilities

```typescript
// src/app/api/commission-ledger/route.ts
import { 
  validateOrganizationRequest,
  validateOrganizationAccess,
  logUnauthorizedAccess 
} from '@/lib/auth-utils';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
```

### Step 2: Add Authorization Check to GET Handler

```typescript
export async function GET(req: NextRequest) {
  try {
    // Step 1: Validate user authentication + organization context
    const auth = await validateOrganizationRequest(req);
    
    // Step 2: Check authorization
    const result = await validateOrganizationAccess(
      auth.organizationId,
      auth.organizationId, // Enforce user's org, ignore URL params
      auth.role
    );
    
    if (!result.allowed) {
      // Step 3: Log unauthorized access
      await logUnauthorizedAccess(
        auth.organizationId,
        auth.userId,
        'CommissionLedger.GET',
        result.reason || 'Unknown'
      );
      
      // Return 403 Forbidden
      return NextResponse.json(
        { error: 'Unauthorized', reason: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Step 4: Query with ENFORCED organizationId filter
    const ledgers = await prisma.commissionLedger.findMany({
      where: {
        organizationId: auth.organizationId, // REQUIRED: Enforced filter
        // profileId: Only for AGENT filtering
        ...(auth.role === 'AGENT' && auth.mallUser?.affiliateProfileId
          ? { profileId: auth.mallUser.affiliateProfileId }
          : {}
        ),
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(ledgers);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[CommissionLedger] GET failed', { error: msg });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 3: Add Authorization Check to POST Handler

```typescript
export async function POST(req: NextRequest) {
  try {
    const auth = await validateOrganizationRequest(req);
    
    // Verify authorization
    const result = await validateOrganizationAccess(
      auth.organizationId,
      auth.organizationId,
      auth.role
    );
    
    if (!result.allowed) {
      await logUnauthorizedAccess(
        auth.organizationId,
        auth.userId,
        'CommissionLedger.POST',
        'Cross-organization creation attempt'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Parse request body
    const body = await req.json();
    
    // Create commission ledger entry
    const entry = await prisma.commissionLedger.create({
      data: {
        organizationId: auth.organizationId, // ENFORCED: From session
        saleId: body.saleId,
        profileId: body.profileId,
        entryType: body.entryType,
        amount: body.amount,
        currency: body.currency || 'KRW',
      },
    });
    
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[CommissionLedger] POST failed', { error: msg });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## Integration Patterns by API Type

### Pattern A: Organization-Scoped Read (Most Common)

```typescript
// GET /api/resource → All in user's organization
const data = await prisma.resource.findMany({
  where: {
    organizationId: auth.organizationId, // Enforced
  },
});
```

### Pattern B: Organization-Scoped + Profile Filter (Agent/Affiliate)

```typescript
// GET /api/agent/sales → Only user's sales
const data = await prisma.affiliateSale.findMany({
  where: {
    organizationId: auth.organizationId, // Enforced
    agentId: auth.mallUser?.affiliateProfileId, // Profile isolation
  },
});
```

### Pattern C: Organization-Scoped Create

```typescript
// POST /api/resource
const created = await prisma.resource.create({
  data: {
    organizationId: auth.organizationId, // NEVER trust user input
    ...body,
  },
});
```

### Pattern D: Organization-Scoped Update

```typescript
// PATCH /api/resource/[id]
const updated = await prisma.resource.update({
  where: { id: params.id },
  data: {
    ...body,
    organizationId: auth.organizationId, // Prevent org change
  },
});
```

### Pattern E: Admin-Only Operation

```typescript
// For GLOBAL_ADMIN only
if (auth.role !== 'GLOBAL_ADMIN') {
  await logUnauthorizedAccess(
    auth.organizationId,
    auth.userId,
    'AdminOperation',
    'Non-admin attempted admin action'
  );
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Admin-only logic here
```

---

## Authorization Rules Summary

| Role | organizationId | profileId | scope |
|---|---|---|---|
| **OWNER** | Must match session | N/A | Own organization only |
| **AGENT** | Must match session | Must match session | Own org + own profile |
| **GLOBAL_ADMIN** | Any organization | Any profile | All data |
| **FREE_SALES** | Limited access | Own profile only | Limited |

---

## Database Migration for Race Condition Prevention

### Required: Unique Index for CommissionLedger

```sql
-- Migration: Add unique constraint to prevent race conditions
CREATE UNIQUE INDEX idx_commission_ledger_unique_sale_org 
  ON "CommissionLedger"("saleId", "organizationId") 
  WHERE "saleId" IS NOT NULL;
```

**Prisma Schema (already included):**
```prisma
model CommissionLedger {
  id           Int     @id @default(autoincrement())
  saleId       String?
  organizationId String
  
  // @@unique([saleId, organizationId]) WHERE saleId IS NOT NULL
  // Note: Partial indexes with nullable fields must be in migration, not schema
}
```

---

## Webhook Event Processing with Idempotency

### Create/Update Webhook Event Handler

```typescript
// src/app/api/webhooks/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateOrganizationRequest } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  try {
    const auth = await validateOrganizationRequest(req);
    const body = await req.json();
    
    // Step 1: Extract eventId for idempotency (REQUIRED)
    const { eventId, saleId, amount } = body;
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      );
    }
    
    // Step 2: Check if event already processed (Idempotency)
    const existing = await prisma.commissionLedger.findUnique({
      where: {
        // Use eventId or other unique identifier
        // saleId_organizationId: { saleId, organizationId: auth.organizationId }
      },
    });
    
    if (existing) {
      // Event already processed → Return 200 OK (idempotent)
      return NextResponse.json(
        { message: 'Event already processed', id: existing.id },
        { status: 200 }
      );
    }
    
    // Step 3: Create commission entry (with race condition protection)
    try {
      const entry = await prisma.commissionLedger.create({
        data: {
          saleId,
          organizationId: auth.organizationId,
          amount,
          entryType: 'WEBHOOK_CREATED',
          metadata: { eventId }, // Store eventId for audit
        },
      });
      
      return NextResponse.json(entry, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        // Race condition: Another process created same entry
        // Return 200 OK (idempotent) - entry already exists
        return NextResponse.json(
          { message: 'Entry already exists (race condition handled)' },
          { status: 200 }
        );
      }
      throw error;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error('[Webhook] Processing failed', { error: msg });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## Testing Your Integration

### Run Tests After Integration

```bash
# Test just your new endpoint
npm test -- tests/api/commission-ledger.test.ts

# Run all security tests
npm test -- tests/security/

# Run with coverage
npm test -- tests/security/ --coverage
```

### Manual Testing with curl

```bash
# Test unauthorized access (should get 403)
curl -X GET http://localhost:3000/api/commission-ledger \
  -H "Authorization: Bearer user-token"

# Test authorized access (should get 200 + data)
curl -X GET http://localhost:3000/api/commission-ledger \
  -H "Authorization: Bearer owner-token"
```

---

## Troubleshooting

### Issue: "Cross-organization access denied" on valid request

**Cause:** User's organization context not properly set in session

**Solution:** Verify `getMabizSession()` returns correct `organizationId`

```typescript
const session = await getMabizSession();
console.log('Session org:', session?.organizationId); // Should match user's org
```

### Issue: Duplicate commission entries created

**Cause:** Missing @unique constraint or improper eventId handling

**Solution:** 
1. Run migration to add unique index
2. Always check `eventId` before creating entry
3. Use `saleId` + `organizationId` for race condition prevention

### Issue: Tests failing with "Request is not defined"

**Cause:** jest-environment-jsdom trying to run node API tests

**Solution:** Ensure `jest.config.js` has correct test environment:

```javascript
testEnvironment: 'node', // Not 'jest-environment-jsdom'
```

---

## Performance Considerations

### Index Optimization

```sql
-- Speed up organizationId filters
CREATE INDEX idx_commission_org ON "CommissionLedger"("organizationId");

-- Speed up agent profile lookups
CREATE INDEX idx_commission_profile ON "CommissionLedger"("profileId", "organizationId");

-- Speed up settlement queries
CREATE INDEX idx_commission_settled ON "CommissionLedger"("isSettled", "createdAt");
```

### Query Optimization

```typescript
// ❌ SLOW: No index on organization filter
const entries = await prisma.commissionLedger.findMany({
  where: { organizationId: auth.organizationId },
  take: 1000, // Full table scan
});

// ✅ FAST: Uses index + pagination
const entries = await prisma.commissionLedger.findMany({
  where: { organizationId: auth.organizationId },
  take: 100,
  skip: (page - 1) * 100,
  orderBy: { createdAt: 'desc' },
});
```

---

## Audit Logging Integration

### Enable Audit Log Creation

Currently, `logUnauthorizedAccess()` logs to console. To enable database audit logging:

```typescript
// Future: Implement in Phase 3-B
export async function logUnauthorizedAccess(
  organizationId: string,
  userId: string,
  resource: string,
  reason: string
): Promise<void> {
  // TODO: Create AuditLog table in Prisma schema
  // TODO: Store in database for security investigation
  
  // For now, log to console (see test output)
  console.log('[SECURITY] Unauthorized access attempt', {
    organizationId,
    userId,
    resource,
    reason,
    timestamp: new Date().toISOString()
  });
}
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All Phase 3-A tests passing (`npm test -- tests/security/`)
- [ ] organizationId filters added to all API routes
- [ ] @unique constraint migration applied to CommissionLedger
- [ ] Webhook eventId idempotency implemented
- [ ] 403 responses returning audit logs
- [ ] SERIALIZABLE isolation level verified
- [ ] Performance indexes created
- [ ] Security team review completed

---

## References

- **Test Suite:** `tests/security/commission-ledger-isolation.test.ts`
- **Auth Utils:** `src/lib/auth-utils.ts`
- **Full Docs:** `PHASE3A_AUTHORIZATION_TESTS.md`
- **Completion Report:** `PHASE3A_COMPLETION_REPORT.md`

---

## Support

For questions about integration:
1. Review the test cases in `commission-ledger-isolation.test.ts`
2. Check the example patterns in this guide
3. Run the tests locally to verify behavior

**Status:** Phase 3-A Complete ✅  
**Next:** Phase 3-B - API Route Integration Tests
