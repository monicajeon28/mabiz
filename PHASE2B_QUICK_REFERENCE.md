# Phase 2-B: Quick Reference Guide

## 🎯 Key Concepts

### 1. Smart Retry Strategy
**When to use**: Any HTTP error from external service

```typescript
import { retryStrategy } from '@/lib/webhooks/retry-strategy';

// Classify any error
const classification = retryStrategy.classifyError(error);
// { retryable: true/false, dlq: true/false, statusCode?: number, reason: string }

// Use classification to decide next action
if (classification.dlq) {
  // Send to Dead Letter Queue (admin review needed)
  logger.error('DLQ:', classification.reason);
} else if (classification.retryable) {
  // Schedule retry with exponential backoff
  const nextRetry = retryStrategy.calculateNextRetryAt(attemptNumber);
  scheduleRetry(nextRetry);
}
```

### 2. Saga Pattern
**When to use**: Multi-step database operations that need transaction-like semantics

```typescript
import { SettlementSaga, SettlementSagaContext } from '@/lib/webhooks/settlement-saga';

// Create saga context
const context: SettlementSagaContext = {
  eventId: 'evt_123',
  organizationId: 'org_abc',
  settlementId: 456,
  partnerId: 789,
  period: '2026-05',
  status: 'PAID',
  amount: 1000000,
  netAmount: 820000,
  commissionRate: 18,
  paymentDate: '2026-05-31',
  executedSteps: new Map(),
};

// Execute saga
const saga = new SettlementSaga(context);
const result = await saga.execute();

if (!result.success) {
  // Automatic rollback already happened
  console.error('Failed step:', result.failedStep);
  // Safe to retry - state is clean
}
```

---

## 📊 HTTP Status Code Quick Reference

| Code | Policy | Action |
|---|---|---|
| 400, 401, 403, 404, 409, 422 | **DLQ** | ❌ No retry → Admin review |
| 500, 502, 503, 504 | **Retry** | ✅ Exponential backoff (5 attempts) |
| 408, 429 | **Retry** | ✅ Exponential backoff with jitter |

---

## ⏱️ Retry Schedule

**Default Configuration** (baseDelayMs=1000ms, backoffFactor=2.0):

```
Attempt 1: 1s   (1000ms + jitter)
Attempt 2: 2s   (2000ms + jitter)
Attempt 3: 4s   (4000ms + jitter)
Attempt 4: 8s   (8000ms + jitter)
Attempt 5: 16s  (16000ms + jitter)
         = 31s total before DLQ
```

**Rate Limit (429) Configuration** (2x baseDelayMs):

```
Attempt 1: 2s   (2000ms + jitter)
Attempt 2: 4s   (4000ms + jitter)
Attempt 3: 8s   (8000ms + jitter)
Attempt 4: 16s  (16000ms + jitter)
Attempt 5: 32s  (32000ms + jitter, capped at 60s)
         = 62s total before DLQ
```

---

## 🔄 Saga Compensation Examples

### Scenario 1: Step 1 succeeds, Step 2 fails
```
[Step 1] Create Commission Ledger ✅
[Step 2] Create Settlement Event ❌
[COMPENSATION] Delete Commission Ledger ✅
Result: Clean state, safe to retry
```

### Scenario 2: All steps succeed
```
[Step 1] Create Commission Ledger ✅
[Step 2] Create Settlement Event ✅
[Step 3] Mark as Processed ✅
Result: Transaction complete, idempotency guaranteed
```

### Scenario 3: Database timeout during Step 2
```
[Step 1] Create Commission Ledger ✅
[Step 2] Create Settlement Event ❌ (TIMEOUT)
[COMPENSATION] Delete Commission Ledger ✅
Result: Saga marked retryable, scheduler will retry
```

---

## 🛡️ Error Handling Template

```typescript
try {
  const saga = new SettlementSaga(context);
  const result = await saga.execute();

  if (!result.success) {
    // Automatic compensation has run
    // Determine if this should be retried or sent to DLQ
    
    const shouldRetry = result.failedStep === 'CREATE_COMMISSION_LEDGER';
    // (Step 1 failures are usually transient DB issues)
    
    if (shouldRetry) {
      logger.warn('Saga failed, will retry:', {
        failedStep: result.failedStep,
        error: result.error,
      });
      return NextResponse.json({
        ok: false,
        retryable: true,
      }, { status: 500 });
    } else {
      // Step 2 or 3 failure might require investigation
      return NextResponse.json({
        ok: false,
        dlq: true,
      }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, status: 'processed' });
} catch (error) {
  const classification = retryStrategy.classifyError(error);
  const statusCode = classification.dlq ? 400 : 500;

  return NextResponse.json({
    ok: false,
    ...classification,
  }, { status: statusCode });
}
```

---

## 🚀 Common Patterns

### Pattern 1: Webhook with Saga
```typescript
// Step 1: Verify signature & parse payload
const payload = await req.json();

// Step 2: Check idempotency before saga
const existing = await prisma.processedWebhookEvent.findUnique({
  where: { eventId: payload.eventId },
});
if (existing) return NextResponse.json({ ok: true, duplicate: true });

// Step 3: Execute saga (includes idempotency marking in Step 3)
const saga = new SettlementSaga(sagaContext);
const result = await saga.execute();

// Step 4: Handle result
if (!result.success) {
  return NextResponse.json({
    ok: false,
    error: result.error,
    failedStep: result.failedStep,
  }, { status: 500 });
}

return NextResponse.json({ ok: true, status: 'processed' });
```

### Pattern 2: Classification in catch block
```typescript
catch (error) {
  const { retryable, dlq, statusCode, reason } = retryStrategy.classifyError(error);
  
  const httpStatus = dlq ? 400 : 500;
  
  return NextResponse.json({
    ok: false,
    reason,
    retryable,
    dlq,
  }, { status: httpStatus });
}
```

### Pattern 3: Custom retry config
```typescript
import { RetryConfig } from '@/lib/webhooks/retry-strategy';

const customConfig: RetryConfig = {
  maxRetries: 3,        // Only 3 attempts
  baseDelayMs: 500,     // Start at 500ms
  backoffFactor: 3.0,   // Triple each time
  maxDelayMs: 120000,   // Cap at 2 minutes
};

const nextRetry = retryStrategy.calculateNextRetryAt(attemptNumber, customConfig);
```

---

## 🔗 File Locations

- **Retry Strategy**: `src/lib/webhooks/retry-strategy.ts`
- **Settlement Saga**: `src/lib/webhooks/settlement-saga.ts`
- **Webhook Route**: `src/app/api/webhooks/cruisedot-settlement/route.ts`

---

## ✅ Before Deploying

```bash
# 1. Verify types
npx tsc --noEmit

# 2. Test saga logic
npm test -- settlement-saga

# 3. Review error classification
npm test -- retry-strategy

# 4. Check integration test
npm test -- cruisedot-settlement.route

# 5. Build (after stopping dev server if running)
npm run build
```

---

## 📞 Debugging Tips

### Debug Saga Execution
```typescript
logger.log('[SettlementSaga] Debug:', {
  completedSteps: result.completedSteps,
  failedStep: result.failedStep,
  error: result.error,
});
```

### Debug Retry Decision
```typescript
const classification = retryStrategy.classifyError(error);
logger.log('[Retry Decision]:', {
  statusCode: classification.statusCode,
  retryable: classification.retryable,
  dlq: classification.dlq,
  reason: classification.reason,
});
```

### Watch Saga Compensation
All compensation steps are logged:
```
[SettlementSaga] Step 1 compensated: Commission Ledger deleted
[SettlementSaga] Step 2 compensated: Settlement Event deleted
[SettlementSaga] Compensation chain completed
```

---

## 🎓 Advanced: Custom Saga

Want to create your own saga? Copy this template:

```typescript
import { SettlementSagaContext } from '@/lib/webhooks/settlement-saga';

export class CustomSaga {
  private context: CustomContext;
  private completedSteps: string[] = [];

  constructor(context: CustomContext) {
    this.context = context;
  }

  private createStep1(): SagaStep {
    return {
      name: 'STEP_1_NAME',
      execute: async () => {
        try {
          const result = await doSomething();
          return { success: true, data: result };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      compensate: async () => {
        await undoStep1();
      },
    };
  }

  async execute() {
    try {
      await prisma.$transaction(async (tx) => {
        // Step 1
        // Step 2
        // Step 3
      }, { isolationLevel: 'Serializable' });
      return { success: true, completedSteps: this.completedSteps };
    } catch (error) {
      await this.compensate();
      return { success: false, error: error.message };
    }
  }
}
```

---

**Last Updated**: 2026-06-01  
**Version**: 1.0
