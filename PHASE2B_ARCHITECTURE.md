# Phase 2-B: Architecture & Technical Deep Dive

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Cruisedot Webhook (Incoming)                     │
│                    POST /api/webhooks/cruisedot-settlement           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  1. Signature Verification (HMAC)    │
        │  - createHmac('sha256', secret)      │
        │  - timingSafeEqual for timing safety │
        │  - Return 401 if invalid             │
        └──────────────────────────┬───────────┘
                                   │
                                   ▼
        ┌──────────────────────────────────────┐
        │  2. Idempotency Check                │
        │  - findUnique(eventId)               │
        │  - Return 200 if duplicate           │
        │  - Otherwise continue                │
        └──────────────────────────┬───────────┘
                                   │
                                   ▼
        ┌──────────────────────────────────────────────────────────────┐
        │         3. Settlement Saga Execution (SERIALIZABLE)          │
        │                                                              │
        │  ┌────────────────────────────────────────────────────────┐ │
        │  │ prisma.$transaction(async (tx) => {                  │ │
        │  │   isolationLevel: 'Serializable'                     │ │
        │  │   timeout: 30000ms                                   │ │
        │  │                                                       │ │
        │  │   Step 1: Create Commission Ledger                  │ │
        │  │   - commissionLedger.create()                       │ │
        │  │   - entryType: 'SETTLEMENT_COMMISSION'              │ │
        │  │   - amount calculated from rate                     │ │
        │  │   ↓                                                  │ │
        │  │   Step 2: Create Settlement Event Log               │ │
        │  │   - settlementEvent.create()                        │ │
        │  │   - eventType: `SETTLEMENT_${status}`               │ │
        │  │   - Metadata with all details                       │ │
        │  │   ↓                                                  │ │
        │  │   Step 3: Mark Event as Processed                  │ │
        │  │   - processedWebhookEvent.create()                  │ │
        │  │   - Status: 'SUCCESS'                               │ │
        │  │   - Guarantees idempotency for future requests      │ │
        │  │                                                       │ │
        │  │ }, isolationLevel: 'Serializable')                │ │
        │  └────────────────────────────────────────────────────────┘ │
        │                                                              │
        │  On Success:                                               │
        │  ✅ All 3 steps committed atomically                       │
        │  ✅ Return { success: true, steps: [...] }               │
        │                                                              │
        │  On Failure (e.g., Step 2 fails):                         │
        │  ❌ Step 1: CommissionLedger created (saved)              │
        │  ❌ Step 2: SettlementEvent creation failed               │
        │  ❌ Transaction rolls back automatically (Serializable)   │
        │  ❌ Step 1 compensation: Delete CommissionLedger          │
        │  ❌ Return { success: false, failedStep: 'STEP_2' }      │
        └──────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
        ┌──────────────────────────────────────┐
        │  4. Error Classification             │
        │  (retryStrategy.classifyError)       │
        │                                      │
        │  Check status code / error message  │
        │  ↓                                   │
        │  Classification:                    │
        │  { retryable, dlq, statusCode,     │
        │    reason }                         │
        └──────────────────────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
        ┌──────────────────────────┐  ┌──────────────────────────┐
        │  DLQ (4xx errors)        │  │  Retryable (5xx, 429)    │
        │  Status: 400             │  │  Status: 500             │
        │                          │  │                          │
        │  - Admin review needed   │  │  - Schedule retry        │
        │  - No auto-retry         │  │  - Exponential backoff   │
        │  - Log for investigation │  │  - Max 5 attempts        │
        └──────────────────────────┘  └──────────────────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
        ┌──────────────────────────────────────┐
        │  Response to Cruisedot API           │
        │  JSON: {                             │
        │    ok: boolean,                     │
        │    status: string,                  │
        │    retryable?: boolean,             │
        │    dlq?: boolean,                   │
        │    failedStep?: string,             │
        │    error?: string                   │
        │  }                                  │
        └──────────────────────────────────────┘
```

---

## 🔄 Saga Pattern: Detailed Step Execution

### Happy Path (All Steps Succeed)

```
[Client] POST /api/webhooks/cruisedot-settlement
         Payload: { eventId, settlementId, partnerId, amount, ... }
         │
         ▼
[Server] Auth + Idempotency checks pass
         │
         ▼
[Saga]   ┌─ Step 1: CREATE_COMMISSION_LEDGER
         │          INSERT INTO commission_ledger
         │          VALUES (partnerId, amount, ..., metadata)
         │          ✅ ledgerId = 12345 (saved to Map)
         │          └─ Complete Step 1
         │
         ├─ Step 2: CREATE_SETTLEMENT_EVENT
         │          INSERT INTO settlement_event
         │          VALUES (settlementId, "SETTLEMENT_PAID", ..., metadata)
         │          ✅ eventId = 67890 (saved to Map)
         │          └─ Complete Step 2
         │
         └─ Step 3: MARK_PROCESSED
                   INSERT INTO processed_webhook_event
                   VALUES (eventId, "SUCCESS")
                   ✅ entryId = 11111 (saved to Map)
                   └─ Complete Step 3
         │
         ▼
[TX]     SERIALIZABLE commit all 3 inserts atomically
         │
         ▼
[Response] HTTP 200
         {
           "ok": true,
           "status": "processed",
           "settlementId": 456,
           "commissionAmount": 180000,
           "sagaSteps": ["CREATE_COMMISSION_LEDGER", "CREATE_SETTLEMENT_EVENT", "MARK_PROCESSED"]
         }
```

### Failure Path (Step 2 Fails)

```
[Client] POST /api/webhooks/cruisedot-settlement
         │
         ▼
[Server] Auth + Idempotency checks pass
         │
         ▼
[Saga]   ┌─ Step 1: CREATE_COMMISSION_LEDGER
         │          INSERT INTO commission_ledger
         │          ✅ ledgerId = 12345 (saved to Map)
         │
         ├─ Step 2: CREATE_SETTLEMENT_EVENT
         │          INSERT INTO settlement_event
         │          ❌ ERROR: "Deadlock detected" or "Timeout"
         │          └─ Return { success: false }
         │
         └─ [Compensation Chain - REVERSE ORDER]
                   └─ Step 1 Compensation:
                      DELETE FROM commission_ledger
                      WHERE id = 12345  (from Map)
                      ✅ Deleted
         │
         ▼
[TX]     SERIALIZABLE rollback everything
         Database state: CLEAN (no ledger, no event)
         │
         ▼
[Response] HTTP 500
         {
           "ok": false,
           "error": "Deadlock detected",
           "failedStep": "CREATE_SETTLEMENT_EVENT",
           "retryable": true,
           "dlq": false
         }
         │
         ▼
[Scheduler] Schedule retry in 1000ms
         (Next retry: Attempt 2 at +2000ms, etc.)
```

### Duplicate Path (Idempotency)

```
[Client] POST /api/webhooks/cruisedot-settlement
         Payload: { eventId: "evt_abc123", ... }
         │
         ▼
[Server] SELECT * FROM processed_webhook_event
         WHERE eventId = "evt_abc123"
         │
         ▼
[Result] ✅ Record FOUND (already processed)
         │
         ▼
[Response] HTTP 200
         {
           "ok": true,
           "duplicate": true,
           "message": "Event already processed"
         }
         │
         Saga NOT executed ✅ (Safety guaranteed)
```

---

## ⏱️ Retry Strategy: Decision Tree

```
                    ┌─ Error received (any type)
                    │
                    ▼
         ┌──────────────────────────┐
         │ Check HTTP Status Code   │
         └──────┬───────────────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
    Has Status     No Status
    (4xx/5xx)      (Network error)
        │               │
        │               ▼
        │         ┌──────────────────────────┐
        │         │ Parse error message      │
        │         │ - ECONNREFUSED           │
        │         │ - ETIMEDOUT              │
        │         │ - "timeout"              │
        │         └──────┬───────────────────┘
        │                │
        │                ▼
        │         ┌──────────────────────────┐
        │         │ Classification:          │
        │         │ retryable: true          │
        │         └──────┬───────────────────┘
        │                │
        ▼                │
    ┌─────────────────────────────────────────────┐
    │ Status Code Classification                  │
    │                                             │
    │ 4xx (400, 401, 403, 404, 409, 422)        │
    │ └─ DLQ = true, retryable = false           │
    │    → Response: 400, admin review needed    │
    │                                             │
    │ 5xx (500, 502, 503, 504)                  │
    │ └─ DLQ = false, retryable = true          │
    │    → Response: 500, schedule retry        │
    │                                             │
    │ Special (408, 429)                        │
    │ └─ DLQ = false, retryable = true          │
    │    → Response: 500, schedule retry        │
    │    → 429 gets 2x delay multiplier         │
    │                                             │
    └─────────┬───────────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────────────────────┐
    │ Calculate Next Retry Time                    │
    │                                              │
    │ if (statusCode === 429) {                   │
    │   delay = baseMs * 2 * (2 ^ (attempt-1))   │
    │ } else {                                     │
    │   delay = baseMs * (2 ^ (attempt-1))       │
    │ }                                            │
    │                                              │
    │ if (delay > maxMs) delay = maxMs            │
    │ jitter = random(-10%, +10%) * delay         │
    │ nextRetry = now() + delay + jitter          │
    │                                              │
    │ Attempt 1: ~1s    (normal) / ~2s (429)     │
    │ Attempt 2: ~2s    (normal) / ~4s (429)     │
    │ Attempt 3: ~4s    (normal) / ~8s (429)     │
    │ Attempt 4: ~8s    (normal) / ~16s (429)    │
    │ Attempt 5: ~16s   (normal) / ~32s (429)    │
    │                                              │
    └──────────────────────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────────────────────┐
    │ Schedule Retry                               │
    │                                              │
    │ INSERT INTO retry_queue (                   │
    │   webhookEventId,                           │
    │   scheduledFor = nextRetry,                │
    │   status = 'QUEUED',                        │
    │   backoffFactor = 2.0,                      │
    │   baseDelayMs = 1000                        │
    │ )                                            │
    │                                              │
    │ Scheduler picks this up at scheduledFor     │
    │ Retries webhook with same payload           │
    │ Saga idempotency check prevents duplication │
    │                                              │
    └──────────────────────────────────────────────┘
```

---

## 🔐 SERIALIZABLE Isolation Level

### Why SERIALIZABLE?

```
Without SERIALIZABLE (default READ COMMITTED):
  Request 1 (same settlement)    Request 2 (same settlement)
        │                               │
        ▼                               ▼
  [Check idempotency]            [Check idempotency]
  ✅ Not found                   ✅ Not found (race!)
        │                               │
        ▼                               ▼
  [Step 1] Insert ledger         [Step 1] Insert ledger
  [Step 2] Insert event          [Step 2] Insert event
  [Step 3] Mark processed        [Step 3] Mark processed
        │                               │
        ▼                               ▼
  Result: 2 ledgers + 2 events + ❌ DUPLICATE ENTRIES
  Inconsistent state!


With SERIALIZABLE:
  Request 1 (same settlement)    Request 2 (same settlement)
        │                               │
        ▼                               ▼
  [BEGIN TRANSACTION]            [BEGIN TRANSACTION]
  [SERIALIZABLE]                 [SERIALIZABLE]
        │                               │
        ▼                               ▼
  [Lock acquired]                [WAIT for lock]
        │                               │
        ▼                               ▼
  [Check idempotency]            [BLOCKED]
  ✅ Not found                         │
        │                               │
        ▼                               ▼
  [Step 1, 2, 3 execute]         [BLOCKED]
        │                               │
        ▼                               ▼
  [COMMIT - lock released]       [Lock acquired]
        │                               │
        ▼                               ▼
  [Response: 200]                [Check idempotency]
                                 ✅ FOUND (from Request 1)
                                      │
                                      ▼
                                 [ROLLBACK]
                                      │
                                      ▼
                                 [Response: 200 duplicate]

Result: Clean state ✅
- Only 1 ledger, 1 event, 1 processed entry
- Request 2 gets 200 with duplicate flag
- Database integrity maintained
```

### Serializable Implementation

```typescript
await prisma.$transaction(
  async (tx) => {
    // All operations here are serialized
    // No concurrent modifications to same settlement
    
    // Step 1: Create Commission Ledger
    // Step 2: Create Settlement Event  
    // Step 3: Mark as Processed
  },
  {
    isolationLevel: 'Serializable',  // ← Key parameter
    timeout: 30000,                   // 30 second timeout
  }
);
```

---

## 📊 Exponential Backoff with Jitter

### Algorithm

```
nextRetryMs = baseMs * (backoffFactor ^ attempt) + jitter
jitter = random(-10%, +10%) * delay

Example timeline (baseMs=1000, backoffFactor=2.0):

Attempt 1:
  delay = 1000 * (2 ^ 0) = 1000ms
  jitter = random(-100, +100)
  actual = 1000 ± 100ms
  range: 900-1100ms
  
Attempt 2:
  delay = 1000 * (2 ^ 1) = 2000ms
  jitter = random(-200, +200)
  actual = 2000 ± 200ms
  range: 1800-2200ms
  
Attempt 3:
  delay = 1000 * (2 ^ 2) = 4000ms
  jitter = random(-400, +400)
  actual = 4000 ± 400ms
  range: 3600-4400ms
  
Attempt 4:
  delay = 1000 * (2 ^ 3) = 8000ms
  jitter = random(-800, +800)
  actual = 8000 ± 800ms
  range: 7200-8800ms
  
Attempt 5:
  delay = 1000 * (2 ^ 4) = 16000ms
  jitter = random(-1600, +1600)
  actual = 16000 ± 1600ms
  range: 14400-17600ms

Total time before DLQ: 31000ms + jitter variance (±3100ms)
= 27900ms to 34100ms ≈ 28-34 seconds
```

### Why Jitter?

```
Without Jitter (problem):
  All 1000 requests fail → All scheduled for 1000ms
  → All retry at exactly 1000ms
  → Server thundering herd ⚡⚡⚡
  → System overload

With Jitter (solution):
  All 1000 requests fail → All scheduled for 1000±100ms
  → Spread across 900-1100ms
  → Server load evenly distributed
  → System recovers gracefully
```

---

## 🧬 Code Flow: Settlement Webhook Complete

```typescript
// 1. Incoming Request
POST /api/webhooks/cruisedot-settlement
Header: Authorization: Bearer <SECRET>
Header: X-Signature: <HMAC-SHA256>
Body: {
  eventId: "evt_abc123",
  settlementId: 789,
  partnerId: 456,
  period: "2026-05",
  status: "PAID",
  amount: 1000000,
  netAmount: 820000,
  commissionRate: 18,
  paymentDate: "2026-05-31"
}

// 2. Signature Verification
const signature = createHmac('sha256', secret)
  .update(body)
  .digest('hex');
if (!timingSafeEqual(received, signature)) {
  return 401 Unauthorized;
}

// 3. Idempotency Check
const existing = processedWebhookEvent.findUnique({ eventId });
if (existing) {
  return 200 OK { ok: true, duplicate: true };
}

// 4. Build Saga Context
const sagaContext = {
  eventId: "evt_abc123",
  settlementId: 789,
  partnerId: 456,
  // ... other fields ...
  executedSteps: new Map(),
};

// 5. Execute Saga
const saga = new SettlementSaga(sagaContext);
const result = await saga.execute();

// Inside saga.execute():
//   prisma.$transaction(async (tx) => {
//     Step 1: commissionLedger.create() → OK
//     Step 2: settlementEvent.create() → OK
//     Step 3: processedWebhookEvent.create() → OK
//   }, { isolationLevel: 'Serializable' })

// 6. Check Result
if (!result.success) {
  // Compensation already ran
  // Database is clean
  const classification = retryStrategy.classifyError(error);
  return 500 (if retryable) or 400 (if DLQ);
}

// 7. Success Response
return 200 OK {
  ok: true,
  status: "processed",
  settlementId: 789,
  commissionAmount: 180000,
  sagaSteps: ["CREATE_COMMISSION_LEDGER", "CREATE_SETTLEMENT_EVENT", "MARK_PROCESSED"]
};

// 8. Future Duplicate Request
POST /api/webhooks/cruisedot-settlement (eventId: "evt_abc123")
  ↓
  Idempotency check: ✅ FOUND
  ↓
  return 200 OK { ok: true, duplicate: true }
  ↓
  Saga NOT executed ✅
```

---

## 🔗 Integration with Existing Systems

### Database Schema (Prisma)

```prisma
model CommissionLedger {
  id            String   @id @default(cuid())
  organizationId String
  profileId     Int      // GMCruise affiliate ID
  entryType     String   // 'SETTLEMENT_COMMISSION'
  amount        Int      // Commission amount
  settlementId  Int?     // Link to settlement
  metadata      Json?    // { eventId, period, rate, ... }
}

model SettlementEvent {
  id            String   @id @default(cuid())
  settlementId  Int
  eventType     String   // 'SETTLEMENT_PAID'
  description   String
  metadata      Json?    // { eventId, partnerId, amount, ... }
  createdAt     DateTime @default(now())
}

model ProcessedWebhookEvent {
  id            String   @id @default(cuid())
  eventId       String   @unique
  webhookType   String   // 'cruisedot-settlement'
  status        String   // 'SUCCESS'
  createdAt     DateTime @default(now())
}
```

### Logging Integration

```typescript
// All saga steps log to logger
logger.log('[SettlementSaga] Step 1: Commission Ledger created', {
  ledgerId,
  partnerId,
  amount,
});

logger.error('[SettlementSaga] Step 2 failed', {
  error: err.message,
  settlementId,
});

logger.log('[SettlementSaga] Step 1 compensated', {
  ledgerId,
});
```

---

## 📈 Monitoring Points

```
Key Metrics to Track:

1. Saga Execution
   - Total requests
   - Success rate
   - Failed step distribution
   - Average execution time

2. Retry Behavior
   - Retries scheduled
   - Successful retries (recovery rate)
   - Failed retries → DLQ
   - Retry distribution by attempt #

3. Error Classification
   - DLQ entries (requires investigation)
   - Retryable errors (auto-recovering)
   - Network errors vs HTTP errors

4. Performance
   - P50/P95/P99 execution time
   - Commission ledger consistency
   - Duplicate entry rate (should be 0)
   - Database deadlock frequency
```

---

**Document**: PHASE2B_ARCHITECTURE.md  
**Last Updated**: 2026-06-01  
**Version**: 1.0
