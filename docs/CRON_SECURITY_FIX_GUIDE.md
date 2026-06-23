# Cron Security Fix Guide
## Data Isolation Vulnerability Remediation
## Created: 2026-06-23

---

## Overview

This guide provides step-by-step fixes for 4 CRITICAL IDOR vulnerabilities in SMS Day crons where Contact queries execute without organizationId filtering.

**Files to Patch**:
1. `src/app/api/cron/sms-day0-init/route.ts`
2. `src/app/api/cron/sms-day1-objection/route.ts`
3. `src/app/api/cron/sms-day2-value/route.ts`
4. `src/app/api/cron/sms-day3-action/route.ts`
5. `src/app/api/cron/email-funnel/route.ts` (bonus)

---

## Fix Pattern: Org-by-Org Processing

### Why This Pattern?

- ✅ Clear org isolation boundaries
- ✅ No mixed-org messages in single batch
- ✅ Org-specific SMS config resolution already works
- ✅ ExecutionLog per-org grouping is natural
- ✅ Easier to debug per-org failures

### When to Use Pattern A vs B

| Pattern | Use When | Pros | Cons |
|---------|----------|------|------|
| **A: Org Loop** | <500 contacts/run | Simple, org isolation clear | Slightly more DB queries |
| **B: Condition Filter** | >500 contacts/run, single org focus | Fewer queries, bulk processing | Less clear org boundaries |

**RECOMMENDATION**: Use Pattern A (Org Loop) for all SMS Day crons.

---

## Fix 1: SMS Day 0 Init (`sms-day0-init/route.ts`)

### Current Code (Vulnerable)
```typescript
// Line 116-138
const qualifiedContacts = await prisma.contact.findMany({
  where: {
    lastCruiseDate: { gte: ..., lte: ... },
    smsDay0Sent: false,
    optOutAt: null,
    // ❌ NO organizationId filter
  },
  select: { id: true, phone: true, name: true, organizationId: true, ... },
  take: 1000,
});
```

### Fixed Code (Pattern A - Org Loop)
```typescript
// After line 109 (after logger.log)

logger.log('[CRON/SMS-DAY0] 시작');

// Get all organizations
const organizations = await prisma.organization.findMany({
  select: { id: true },
});

logger.log(`[CRON/SMS-DAY0] 처리 조직: ${organizations.length}개`);

// Process each organization separately
for (const org of organizations) {
  try {
    const qualifiedContacts = await prisma.contact.findMany({
      where: {
        organizationId: org.id,  // ✅ FIX: Add org filter
        lastCruiseDate: {
          gte: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000),
          lte: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000),
        },
        smsDay0Sent: false,
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        lastCruiseDate: true,
        cruiseCount: true,
        vipStatus: true,
      },
      take: 1000,
    });

    if (qualifiedContacts.length === 0) {
      logger.log(`[CRON/SMS-DAY0] 조직 ${org.id}: 자격 고객 없음`);
      continue;
    }

    logger.log(`[CRON/SMS-DAY0] 조직 ${org.id}: ${qualifiedContacts.length}명`);

    // Rest of the loop remains the same: SMS sending, logging, scheduling
    for (const contact of qualifiedContacts) {
      // ... existing code for sendSmsViaAligo, SmsLog creation, etc.
      // ✅ organizationId is already part of contact, so it's safe
    }
  } catch (orgErr) {
    logger.error('[CRON/SMS-DAY0] 조직 처리 오류', { organizationId: org.id, err: orgErr });
    // Continue to next org instead of stopping
  }
}
```

### Detailed Steps

1. **Find the location** (around line 116):
   ```typescript
   const qualifiedContacts = await prisma.contact.findMany({
   ```

2. **Add org loop** before this query:
   ```typescript
   const organizations = await prisma.organization.findMany({
     select: { id: true },
   });
   
   for (const org of organizations) {
     try {
   ```

3. **Update WHERE clause**:
   ```typescript
   where: {
     organizationId: org.id,  // ← ADD THIS
     lastCruiseDate: { ... },
     ...
   }
   ```

4. **Wrap inner loop in try-catch**:
   ```typescript
   } catch (orgErr) {
     logger.error('[CRON/SMS-DAY0] 조직 처리 오류', { organizationId: org.id, err: orgErr });
   }
   ```

5. **ExecutionLog remains valid** because it already includes `c.organizationId` from the contact

---

## Fix 2: SMS Day 1 Objection (`sms-day1-objection/route.ts`)

### Current Code (Vulnerable)
```typescript
// Line 68-87
const day0SentContacts = await prisma.contact.findMany({
  where: {
    smsDay0Sent: true,
    smsDay0SentAt: { gte: day1RangeStart, lte: day1RangeEnd },
    smsDay1Sent: false,
    optOutAt: null,
    // ❌ NO organizationId filter
  },
  ...
});
```

### Fixed Code
```typescript
// After line 61 (after logger.log)

logger.log('[CRON/SMS-DAY1] 시작');

const organizations = await prisma.organization.findMany({
  select: { id: true },
});

logger.log(`[CRON/SMS-DAY1] 처리 조직: ${organizations.length}개`);

for (const org of organizations) {
  try {
    const day0SentContacts = await prisma.contact.findMany({
      where: {
        organizationId: org.id,  // ✅ FIX: Add org filter
        smsDay0Sent: true,
        smsDay0SentAt: {
          gte: day1RangeStart,
          lte: day1RangeEnd,
        },
        smsDay1Sent: false,
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        smsDay0SentAt: true,
        lensMetadata: true,
      },
      take: 1000,
    });

    if (day0SentContacts.length === 0) {
      logger.log(`[CRON/SMS-DAY1] 조직 ${org.id}: Day 0 발송 고객 없음`);
      continue;
    }

    logger.log(`[CRON/SMS-DAY1] 조직 ${org.id}: Day 0 발송 고객 ${day0SentContacts.length}명`);

    // Rest of the loop: SMS sending, CallLog checks, Day 2 scheduling
    for (const contact of day0SentContacts) {
      // ... existing code
    }
  } catch (orgErr) {
    logger.error('[CRON/SMS-DAY1] 조직 처리 오류', { organizationId: org.id, err: orgErr });
  }
}
```

---

## Fix 3: SMS Day 2 Value (`sms-day2-value/route.ts`)

### Current Code (Vulnerable)
```typescript
// Line 94-115
const day1SentContacts = await prisma.contact.findMany({
  where: {
    smsDay1Sent: true,
    smsDay1SentAt: { gte: day2RangeStart, lte: day2RangeEnd },
    smsDay2Sent: false,
    optOutAt: null,
    // ❌ NO organizationId filter
  },
  ...
});
```

### Fixed Code
```typescript
// After line 87 (after logger.log)

logger.log('[CRON/SMS-DAY2] 시작');

const organizations = await prisma.organization.findMany({
  select: { id: true },
});

logger.log(`[CRON/SMS-DAY2] 처리 조직: ${organizations.length}개`);

for (const org of organizations) {
  try {
    const day1SentContacts = await prisma.contact.findMany({
      where: {
        organizationId: org.id,  // ✅ FIX: Add org filter
        smsDay1Sent: true,
        smsDay1SentAt: {
          gte: day2RangeStart,
          lte: day2RangeEnd,
        },
        smsDay2Sent: false,
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        smsDay1SentAt: true,
        cruiseCount: true,
        vipStatus: true,
        lensMetadata: true,
      },
      take: 1000,
    });

    if (day1SentContacts.length === 0) {
      logger.log(`[CRON/SMS-DAY2] 조직 ${org.id}: Day 1 발송 고객 없음`);
      continue;
    }

    logger.log(`[CRON/SMS-DAY2] 조직 ${org.id}: Day 1 발송 고객 ${day1SentContacts.length}명`);

    // Rest of the loop
    for (const contact of day1SentContacts) {
      // ... existing code
    }
  } catch (orgErr) {
    logger.error('[CRON/SMS-DAY2] 조직 처리 오류', { organizationId: org.id, err: orgErr });
  }
}
```

---

## Fix 4: SMS Day 3 Action (`sms-day3-action/route.ts`)

### Current Code (Vulnerable)
```typescript
// Line 67-89
const day2SentContacts = await prisma.contact.findMany({
  where: {
    smsDay2Sent: true,
    smsDay2SentAt: { gte: day3RangeStart, lte: day3RangeEnd },
    smsDay3Sent: false,
    optOutAt: null,
    // ❌ NO organizationId filter
  },
  ...
});
```

### Fixed Code
```typescript
// After line 60 (after logger.log)

logger.log('[CRON/SMS-DAY3] 시작');

const organizations = await prisma.organization.findMany({
  select: { id: true },
});

logger.log(`[CRON/SMS-DAY3] 처리 조직: ${organizations.length}개`);

for (const org of organizations) {
  try {
    const day2SentContacts = await prisma.contact.findMany({
      where: {
        organizationId: org.id,  // ✅ FIX: Add org filter
        smsDay2Sent: true,
        smsDay2SentAt: {
          gte: day3RangeStart,
          lte: day3RangeEnd,
        },
        smsDay3Sent: false,
        optOutAt: null,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        organizationId: true,
        smsDay0SentAt: true,
        smsDay1SentAt: true,
        smsDay2SentAt: true,
        vipStatus: true,
        lensMetadata: true,
      },
      take: 1000,
    });

    if (day2SentContacts.length === 0) {
      logger.log(`[CRON/SMS-DAY3] 조직 ${org.id}: Day 2 발송 고객 없음`);
      continue;
    }

    logger.log(`[CRON/SMS-DAY3] 조직 ${org.id}: Day 2 발송 고객 ${day2SentContacts.length}명`);

    // Rest of the loop
    let totalEngaged = 0;
    for (const contact of day2SentContacts) {
      // ... existing code
    }
  } catch (orgErr) {
    logger.error('[CRON/SMS-DAY3] 조직 처리 오류', { organizationId: org.id, err: orgErr });
  }
}
```

---

## Fix 5: Email Funnel (`email-funnel/route.ts`)

### Current Code (Vulnerable)
```typescript
// Line 51-58
const pendingMessages = await prisma.scheduledEmailMessage.findMany({
  where: {
    status: { in: ["PENDING", "NIGHT_BLOCKED"] },
    scheduledAt: { lte: now },
  },
  orderBy: { scheduledAt: "asc" },
  take: BATCH_SIZE,
  // ❌ NO organizationId filter
});
```

### Fixed Code (Option A: Org Loop)
```typescript
// After line 47

const organizations = await prisma.organization.findMany({
  select: { id: true },
});

logger.log("[Cron/EmailFunnel] 처리 조직", { count: organizations.length });

const pendingMessages: typeof pendingMessages = [];

for (const org of organizations) {
  const orgMessages = await prisma.scheduledEmailMessage.findMany({
    where: {
      organizationId: org.id,  // ✅ FIX: Add org filter
      status: { in: ["PENDING", "NIGHT_BLOCKED"] },
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_SIZE,
  });
  pendingMessages.push(...orgMessages);
  
  if (orgMessages.length > 0) {
    logger.log("[Cron/EmailFunnel] 대상 메시지", { 
      organizationId: org.id, 
      count: orgMessages.length 
    });
  }
}
```

### Fixed Code (Option B: Simple Filter)
```typescript
// Line 51-58, simpler version
const pendingMessages = await prisma.scheduledEmailMessage.findMany({
  where: {
    status: { in: ["PENDING", "NIGHT_BLOCKED"] },
    scheduledAt: { lte: now },
    organizationId: { not: null },  // ✅ FIX: Ensure org association
  },
  orderBy: { scheduledAt: "asc" },
  take: BATCH_SIZE,
});
```

**Use Option A if**: You want to process orgs separately for better isolation
**Use Option B if**: You trust organizationId to be set correctly on all messages

---

## CallLog Validation (Additional Hardening)

In Day 1 and Day 3 crons, when querying CallLog for engagement checks:

### Current Code
```typescript
const callLogCount = contact.smsDay0SentAt ? await prisma.callLog.count({
  where: {
    contactId: contact.id,
    createdAt: { gte: contact.smsDay0SentAt },
  },
}) : 0;
```

### Hardened Code
```typescript
const callLogCount = contact.smsDay0SentAt ? await prisma.callLog.count({
  where: {
    contactId: contact.id,
    organizationId: contact.organizationId,  // ✅ Add org filter if CallLog has this field
    createdAt: { gte: contact.smsDay0SentAt },
  },
}) : 0;
```

**Note**: Check Prisma schema to confirm CallLog has organizationId field. If not, the contact-based isolation is sufficient.

---

## Testing Checklist

### Unit Test Template
```typescript
describe('SMS Day 0 Cron - Multi-Org Isolation', () => {
  it('should only process contacts from assigned organization', async () => {
    // Setup
    const org1 = await createOrganization('Org A');
    const org2 = await createOrganization('Org B');
    
    const contact1 = await createContact({
      organizationId: org1.id,
      lastCruiseDate: new Date(Date.now() - 18 * 60 * 60 * 1000),
      smsDay0Sent: false,
    });
    
    const contact2 = await createContact({
      organizationId: org2.id,
      lastCruiseDate: new Date(Date.now() - 18 * 60 * 60 * 1000),
      smsDay0Sent: false,
    });
    
    // Execute
    await POST('/api/cron/sms-day0-init', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    
    // Verify: Both orgs' contacts should receive SMS
    const logs = await getSmsLogs();
    expect(logs.find(l => l.contactId === contact1.id)).toBeDefined();
    expect(logs.find(l => l.contactId === contact2.id)).toBeDefined();
    
    // But verify org isolation in logs
    expect(logs.find(l => l.contactId === contact1.id)?.organizationId).toBe(org1.id);
    expect(logs.find(l => l.contactId === contact2.id)?.organizationId).toBe(org2.id);
  });
});
```

### Manual Testing Steps
1. Create 2 test organizations
2. Create matching contacts in each (e.g., lastCruiseDate = 18 hours ago)
3. Run cron via Vercel dashboard or direct API call
4. Verify SmsLog entries exist for BOTH orgs
5. Verify no cross-org message leakage
6. Check ScheduledSms for Day 1-3 (should match org)

---

## Deployment Checklist

- [ ] All 4 SMS Day cron files updated with org loop
- [ ] Email funnel cron updated with org filter
- [ ] Code reviewed for completeness
- [ ] No organizationId.undefined errors
- [ ] No "empty org list" scenario (should be rare)
- [ ] Logging captures org-level metrics
- [ ] Tests pass in staging
- [ ] Production deployment scheduled
- [ ] Monitor logs for 24h post-deploy
- [ ] No regression in SMS delivery volume

---

## Rollback Plan

If issues occur post-deployment:

1. **Quick rollback** (< 1 min):
   - Revert git commit
   - Redeploy previous version
   - Monitor SMS logs for gaps

2. **Gradual rollback** (if performance issue):
   - Reduce BATCH_SIZE from 1000 to 500
   - Reduce organization processing parallelism
   - Monitor DB load

3. **Data consistency check**:
   - Compare SmsLog counts (should be similar pre/post)
   - Verify no duplicate ScheduledSms entries
   - Check for orphaned ExecutionLog records

---

## Performance Notes

### Expected Impact
- **Org Loop**: +N queries (where N = number of organizations)
  - Typical: 1-5 orgs → minimal impact
  - Worst case: 100 orgs → ~100 additional findMany queries per cron run
  
- **Mitigation**: 
  - Organizations table is small (< 1MB typically)
  - Contact queries are already filtered by date ranges
  - Parallelism can be added if needed

### Optimization (Post-Deploy)
```typescript
// Future: Batch org processing if > 50 orgs
const batchSize = 5;
for (let i = 0; i < organizations.length; i += batchSize) {
  const orgBatch = organizations.slice(i, i + batchSize);
  await Promise.allSettled(
    orgBatch.map(org => processDayOrgContacts(org))
  );
}
```

---

## Migration Guide for Other Crons

If you find similar patterns in other cron files:

```typescript
// Template for any cron with Contact queries
const organizations = await prisma.organization.findMany({
  select: { id: true },
});

for (const org of organizations) {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId: org.id,  // ← Always add this
        // ... other conditions
      },
    });
    
    // Process org's contacts
  } catch (err) {
    logger.error('[CronName] Org error', { organizationId: org.id, err });
  }
}
```

---

**Last Updated**: 2026-06-23
**Severity**: CRITICAL
**Status**: Ready for Implementation
