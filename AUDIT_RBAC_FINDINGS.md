# RBAC & Data Isolation Vulnerability Audit Report
## Date: 2026-06-23
## Status: CRITICAL FINDINGS DETECTED

---

## Executive Summary

Comprehensive codebase audit identified **4 CRITICAL vulnerabilities** in SMS Cron jobs where Contact queries execute WITHOUT organizationId filtering. This enables:
- **Cross-organization data leakage**: Crons can process contacts from ALL organizations simultaneously
- **SMS cross-org injection**: SMS messages intended for org A could be sent to contacts in org B-Z
- **Data isolation bypass**: A compromised single org's contact can trigger crons affecting all orgs

---

## Critical Vulnerabilities

### 1. SMS Day 0 Initialization Cron (CRITICAL - IDOR)
**File**: `src/app/api/cron/sms-day0-init/route.ts`

**Vulnerable Code** (Lines 116-138):
```typescript
const qualifiedContacts = await prisma.contact.findMany({
  where: {
    // Day 0 조건: lastCruiseEndDate ±24시간
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
    organizationId: true,  // ← RETURNED but NOT FILTERED
    ...
  },
  take: 1000,
});
```

**Vulnerability Type**: IDOR + Cross-Org Data Isolation Bypass

**Risk Level**: **CRITICAL**

**Impact**:
- Cron retrieves contacts from ALL organizations in the database
- Processes up to 1,000 contacts per run
- Sends SMS messages to contacts regardless of their owning organization
- SMS logs (SmsLog) record organizationId but based on unvalidated contact data
- ScheduledSms records created for Day 1-3 may target wrong orgs

**Attack Scenario**:
1. Org A creates a contact with lastCruiseDate matching Day 0 conditions
2. Org B's contact also matches (coincidentally or via data manipulation)
3. Cron sends SMS to Org B's contact using Org A's SMS configuration
4. If orgs share SMS provider, Org A's message appears in Org B's history

**Suggested Fix**:
```typescript
// Add organizationId filter (but cron has NO user context!)
// Option A: Process all orgs separately with proper isolation
const organizations = await prisma.organization.findMany({
  select: { id: true },
});

for (const org of organizations) {
  const qualifiedContacts = await prisma.contact.findMany({
    where: {
      organizationId: org.id,  // ← FIX: Filter by org
      lastCruiseDate: { ... },
      smsDay0Sent: false,
      optOutAt: null,
    },
    // ... rest
  });
  // Process org's contacts only
}

// Option B: Use buildContactWhere() helper if available
import { buildContactWhere } from '@/lib/contacts/access-control';
const where = buildContactWhere({ organizationId: ??? }, { ... });
```

---

### 2. SMS Day 1 Objection Handling Cron (CRITICAL - IDOR)
**File**: `src/app/api/cron/sms-day1-objection/route.ts`

**Vulnerable Code** (Lines 68-87):
```typescript
const day0SentContacts = await prisma.contact.findMany({
  where: {
    smsDay0Sent: true,
    smsDay0SentAt: {
      gte: day1RangeStart,
      lte: day1RangeEnd,
    },
    smsDay1Sent: false,
    optOutAt: null,
    // ❌ NO organizationId FILTER
  },
  select: {
    id: true,
    phone: true,
    name: true,
    organizationId: true,  // ← RETURNED but NOT FILTERED
    ...
  },
  take: 1000,
});
```

**Vulnerability Type**: IDOR + Cross-Org Data Isolation Bypass

**Risk Level**: **CRITICAL**

**Impact**:
- Same as Day 0, but triggers 24 hours after Day 0
- Sends objection-handling messages (e.g., price negotiation) to unrelated orgs
- Risk Flag updates (priceObjectionDetected) applied to wrong contacts

**Attack Scenario**:
- Attacker times contact creation to match Day 0 send window
- Day 1 cron sends "special financing offer" message to Org B contact
- Org B customer receives unsolicited financing message

---

### 3. SMS Day 2 Value Message Cron (CRITICAL - IDOR)
**File**: `src/app/api/cron/sms-day2-value/route.ts`

**Vulnerable Code** (Lines 94-115):
```typescript
const day1SentContacts = await prisma.contact.findMany({
  where: {
    smsDay1Sent: true,
    smsDay1SentAt: {
      gte: day2RangeStart,
      lte: day2RangeEnd,
    },
    smsDay2Sent: false,
    optOutAt: null,
    // ❌ NO organizationId FILTER
  },
  select: {
    id: true,
    phone: true,
    name: true,
    organizationId: true,  // ← RETURNED but NOT FILTERED
    ...
  },
  take: 1000,
});
```

**Vulnerability Type**: IDOR + Cross-Org Data Isolation Bypass

**Risk Level**: **CRITICAL**

**Impact**:
- Sends value/savings messages ($2,334 savings claims, customer stories)
- Processes contacts from any organization
- Could expose competitor pricing or terms to unrelated orgs

---

### 4. SMS Day 3 Action/Closing Cron (CRITICAL - IDOR)
**File**: `src/app/api/cron/sms-day3-action/route.ts`

**Vulnerable Code** (Lines 67-89):
```typescript
const day2SentContacts = await prisma.contact.findMany({
  where: {
    smsDay2Sent: true,
    smsDay2SentAt: {
      gte: day3RangeStart,
      lte: day3RangeEnd,
    },
    smsDay3Sent: false,
    optOutAt: null,
    // ❌ NO organizationId FILTER
  },
  select: {
    id: true,
    phone: true,
    name: true,
    organizationId: true,  // ← RETURNED but NOT FILTERED
    ...
  },
  take: 1000,
});
```

**Vulnerability Type**: IDOR + Cross-Org Data Isolation Bypass

**Risk Level**: **CRITICAL**

**Impact**:
- Final closing message with urgency/scarcity claims
- Highest risk: sends booking links that may not match contact's org
- Could trigger unintended bookings/conversions across org boundaries

---

## Email Funnel Cron Vulnerability

### 5. Email Funnel Scheduled Messages (CRITICAL - IDOR)
**File**: `src/app/api/cron/email-funnel/route.ts`

**Vulnerable Code** (Lines 51-58):
```typescript
const pendingMessages = await prisma.scheduledEmailMessage.findMany({
  where: {
    status: { in: ["PENDING", "NIGHT_BLOCKED"] },
    scheduledAt: { lte: now },
  },
  orderBy: { scheduledAt: "asc" },
  take: BATCH_SIZE,
  // ❌ NO organizationId FILTER on ScheduledEmailMessage
});
```

**Vulnerability Type**: IDOR + Cross-Org Data Isolation Bypass

**Risk Level**: **CRITICAL**

**Impact**:
- Retrieves ALL pending email messages across ALL organizations
- Attempts to resolve SMTP config via `resolveUserEmailConfig(msg.organizationId, ...)`
- If message.organizationId is NULL or manipulated, sends via default org's SMTP
- Batch Size 100 means up to 100 messages/run could be from different orgs

**Note**: Line 116 does use `msg.organizationId` for SMTP resolution, providing partial mitigation, but the query itself has no org filtering.

---

## Non-Vulnerable Crons (For Comparison)

### ✅ Scheduled Kakao Cron (SAFE)
**File**: `src/app/api/cron/scheduled-kakao/route.ts` (Lines 98, 105)
```typescript
const c = await prisma.contact.findFirst({
  where: { 
    id: item.contactId, 
    organizationId: item.organizationId,  // ✅ CORRECT
    deletedAt: null 
  },
});
```

### ✅ Group Auto-Move Cron (SAFE)
**File**: `src/app/api/cron/group-auto-move/route.ts` (Line 40)
```typescript
const target = await prisma.contactGroup.findFirst({
  where: { 
    id: targetId, 
    organizationId: group.organizationId  // ✅ CORRECT
  },
});
```

### ✅ Lens Batch Process Cron (SAFE)
**File**: `src/app/api/cron/lens-batch-process/route.ts` (Lines 67-72)
```typescript
// Groups contacts by organizationId before processing
const byOrg = new Map<string, typeof staleContacts>();
for (const c of staleContacts) {
  const list = byOrg.get(c.organizationId) ?? [];
  list.push(c);
  byOrg.set(c.organizationId, list);  // ✅ Org isolation
}
```

---

## Additional Findings (Medium Risk)

### Potential Issue: CallLog Queries in Day Crons
**Files**: `sms-day1-objection/route.ts` (Line 105), `sms-day3-action/route.ts` (Line 109)

```typescript
const callLogCount = contact.smsDay0SentAt ? await prisma.callLog.count({
  where: {
    contactId: contact.id,
    createdAt: { gte: contact.smsDay0SentAt },
  },
}) : 0;
```

**Issue**: CallLog table not filtered by organizationId. While contactId is specific, if an attacker controls contactIds across orgs, they could manipulate engagement counts.

**Mitigation**: Add organizational validation before using callLogCount results.

---

## Recommended Fixes (Priority Order)

### Priority 1: CRITICAL - Cron organizationId Filtering
Apply to all 4 SMS Day crons:

**Pattern A: Org-by-org processing** (Recommended)
```typescript
// Process each organization separately
const organizations = await prisma.organization.findMany({
  select: { id: true },
});

for (const org of organizations) {
  const qualifiedContacts = await prisma.contact.findMany({
    where: {
      organizationId: org.id,  // ✅ ADD THIS
      lastCruiseDate: { ... },
      smsDay0Sent: false,
      optOutAt: null,
    },
    ...
  });
  // Process org's contacts only
  for (const contact of qualifiedContacts) {
    // Use contact.organizationId === org.id
  }
}
```

**Pattern B: Use buildContactWhere() if available**
```typescript
import { buildContactWhere } from '@/lib/contacts/access-control';

// For org-scoped cron, pass organizationId
const where = buildContactWhere(
  { organizationId: org.id },  // Scoped context
  { /* condition fields */ }
);
```

### Priority 2: Email Funnel organizationId Filtering
**File**: `src/app/api/cron/email-funnel/route.ts`

```typescript
const pendingMessages = await prisma.scheduledEmailMessage.findMany({
  where: {
    status: { in: ["PENDING", "NIGHT_BLOCKED"] },
    scheduledAt: { lte: now },
    // ✅ ADD THIS
    organizationId: { not: null },  // Ensure valid org association
  },
  orderBy: { scheduledAt: "asc" },
  take: BATCH_SIZE,
});

// Optionally: Process by org to ensure SMTP isolation
const msgsByOrg = new Map<string, typeof pendingMessages>();
for (const msg of pendingMessages) {
  const orgId = msg.organizationId!;
  const list = msgsByOrg.get(orgId) ?? [];
  list.push(msg);
  msgsByOrg.set(orgId, list);
}
```

### Priority 3: CallLog Org Validation
**Files**: `sms-day1-objection/route.ts`, `sms-day3-action/route.ts`

```typescript
// After retrieving callLogCount, validate contact's org
const callLogCount = contact.smsDay0SentAt ? await prisma.callLog.count({
  where: {
    contactId: contact.id,
    // ✅ Add org filter if CallLog has organizationId
    organizationId: contact.organizationId,
    createdAt: { gte: contact.smsDay0SentAt },
  },
}) : 0;
```

---

## Root Cause Analysis

### Why Did This Happen?

1. **Cron Context Ambiguity**: Cron jobs run system-wide without user session. Developers may have assumed:
   - "Contact queries retrieve ALL contacts, that's fine for reporting"
   - "We only send SMS to contacts with valid organizationId"

2. **Incomplete Implementation**: Day 0-3 crons were built before org isolation pattern was standardized:
   - Earlier crons (group-auto-move, lens-batch-process) correctly filter by org
   - Later crons (sms-day0-init, day1-3) inherited flawed pattern

3. **Missing Test Coverage**: No multi-org integration tests for cron behavior

---

## Testing Recommendations

### Multi-Org Test Scenario
```javascript
// Create 2 organizations
org1 = createOrg("Org A");
org2 = createOrg("Org B");

// Create contacts in each
contact1 = createContact({ organizationId: org1.id, lastCruiseDate: (now - 36h) });
contact2 = createContact({ organizationId: org2.id, lastCruiseDate: (now - 36h) });

// Run SMS Day 0 cron
await POST('/api/cron/sms-day0-init', { authorization: `Bearer ${CRON_SECRET}` });

// Verify: Only org1's contact should have SMS log
const logs = await getSmslogs();
assert(logs.filter(l => l.contactId === contact1.id).length > 0, "Org1 contact should receive SMS");
assert(logs.filter(l => l.contactId === contact2.id).length === 0, "Org2 contact should NOT receive SMS");
```

---

## Compliance Impact

- **GDPR**: Potential personal data transfers between organizations
- **HIPAA** (if applicable): Unauthorized contact information access
- **SOC 2**: Data isolation requirement violation
- **Multi-tenancy SLA**: Failure to maintain org boundaries

---

## Summary Table

| File | Cron | Vulnerability | Fix Applied | Severity |
|------|------|----------------|------------|----------|
| sms-day0-init/route.ts | Day 0 | No organizationId filter | ❌ PENDING | CRITICAL |
| sms-day1-objection/route.ts | Day 1 | No organizationId filter | ❌ PENDING | CRITICAL |
| sms-day2-value/route.ts | Day 2 | No organizationId filter | ❌ PENDING | CRITICAL |
| sms-day3-action/route.ts | Day 3 | No organizationId filter | ❌ PENDING | CRITICAL |
| email-funnel/route.ts | Email | Weak organizationId filter | ❌ PENDING | CRITICAL |
| sms-followup/route.ts | Follow-up | Uses ScheduledSms (safe) | ✅ SAFE | N/A |
| re-engage/route.ts | Re-engage | Filters by org cache | ✅ SAFE | N/A |
| group-auto-move/route.ts | Auto-move | Validates org ownership | ✅ SAFE | N/A |
| backup-contacts/route.ts | Backup | Iterates all orgs safely | ✅ SAFE | N/A |
| scheduled-kakao/route.ts | Kakao | Validates contact.organizationId | ✅ SAFE | N/A |

---

## Next Steps

1. **Immediate** (Today): Apply org filtering to 4 SMS Day crons
2. **Short-term** (This week): 
   - Strengthen email-funnel cron org isolation
   - Add multi-org integration tests
3. **Long-term**:
   - Audit all other cron jobs for similar patterns
   - Create "Cron Security Checklist" template
   - Enforce buildContactWhere() for all Contact queries

---

**Report Generated**: 2026-06-23 23:45 UTC
**Auditor**: Claude Code Agent
**Database**: D:\mabiz-crm (Supabase)
