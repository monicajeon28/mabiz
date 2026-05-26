# Day 0-3 Cron Troubleshooting Guide

## Quick Diagnosis Checklist

### Step 1: Verify Cron is Running

```bash
# Check last execution timestamp
curl http://localhost:3000/api/admin/sequence-cron-status
```

Expected response includes:
- `schedule.nextRunAt`: Next scheduled execution
- `health`: Organization statistics
- `recentActivity.lastUpdated`: Last execution time

**Issue**: `lastUpdated` is hours old
→ Cron may not be executing. Check Vercel deployment logs.

### Step 2: Check Metrics

From status endpoint or logs:

```json
{
  "metrics": {
    "sent": 45,
    "errors": 2,
    "completed": 12,
    "failed": 0,
    "organizationsProcessed": 3,
    "elapsedMs": 8234
  }
}
```

**Issues & Thresholds**:
- `sent == 0` for 10+ minutes: No sequences to send OR all failed
- `errors > sent * 0.05`: Error rate >5%, investigate errors
- `elapsedMs > 30000`: Slow execution, check database/API

### Step 3: Verify Sequence Setup

```sql
-- Check if sequences exist and are ACTIVE
SELECT id, name, status, totalSent 
FROM "SmsSequenceTemplate" 
WHERE status = 'ACTIVE' 
LIMIT 10;

-- Check if instances exist and are ACTIVE
SELECT id, status, createdAt, day0SentAt, day1SentAt 
FROM "ContactSequenceInstance" 
WHERE status = 'ACTIVE' 
LIMIT 10;
```

**Expected**:
- At least one ACTIVE sequence template
- At least one ACTIVE sequence instance

## Common Issues & Solutions

### Issue 1: No Messages Being Sent

**Symptoms**:
- `metrics.sent == 0`
- No entries in SmsLog with `channel='DAY_0_3_SEQUENCE'`
- Health shows `active: 0`

**Diagnosis Tree**:

```
├─ No sequences?
│  └─ Check: SELECT COUNT(*) FROM "SmsSequenceTemplate" WHERE status='ACTIVE'
│  └─ Solution: Create/deploy sequence via UI
│
├─ Sequences exist but no instances?
│  └─ Check: SELECT COUNT(*) FROM "ContactSequenceInstance" WHERE status='ACTIVE'
│  └─ Solution: Deploy sequence to contacts
│
├─ Instances exist but day calculation wrong?
│  └─ Check: SELECT createdAt, NOW()-interval '1 day' FROM "ContactSequenceInstance"
│  └─ Solution: Verify current timestamp and createdAt dates
│
└─ All looks good but still not sending?
   └─ Check: CloudWatch logs for [sequence-dispatcher] errors
   └─ Solution: See "Issue 5: Cron Not Executing"
```

### Issue 2: High Error Rate

**Symptoms**:
- `metrics.errorCount > metrics.sentCount * 0.05`
- Many errors in logs like "FAILED_SMS_SEND"

**Diagnosis Tree**:

```
├─ Aligo API errors?
│  └─ Check logs for: result_code != '1'
│  └─ Common codes:
│     ├─ 20: Invalid API key
│     ├─ 21: Insufficient balance
│     └─ 31: Invalid phone number
│  └─ Solution:
│     ├─ Verify ALIGO_API_KEY and ALIGO_USER_ID in .env
│     ├─ Check Aligo account balance
│     └─ Validate phone format (010-XXXX-XXXX)
│
├─ Network errors?
│  └─ Check logs for: "NETWORK_ERROR"
│  └─ Solution:
│     ├─ Check Vercel network connectivity
│     ├─ Verify Aligo API endpoint accessible
│     └─ Check firewall rules
│
├─ Database errors?
│  └─ Check logs for: "database" or "prisma"
│  └─ Solution:
│     ├─ Verify database connection pool
│     ├─ Check for locked tables (ContactSequenceInstance)
│     └─ Review recent migrations
│
└─ Phone number validation?
   └─ Check logs for: "Invalid phone number"
   └─ Solution: Review contact phone format standardization
```

### Issue 3: Messages Sent But Not Progressing Days

**Symptoms**:
- Day 0 sent successfully
- Day 1 never sends (24 hours later)
- `day0SentAt` is set, `day1SentAt` remains null

**Root Cause**: `calculateCurrentDay()` logic failure

**Diagnosis**:
```sql
-- Check instance timeline
SELECT 
  id,
  createdAt,
  NOW() - createdAt as elapsed,
  EXTRACT(HOUR FROM (NOW() - createdAt)) as elapsed_hours,
  day0SentAt, day1SentAt, day2SentAt, day3SentAt
FROM "ContactSequenceInstance"
WHERE id = 'instance-id'
```

**Expected**:
- After 24+ hours: `elapsed_hours > 24`
- Status: Day 1 should be calculated

**Solution**:
```typescript
// Verify function in sequence-lifecycle-service.ts
function calculateCurrentDay(startedAt: Date): number {
  const now = new Date();
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours < 24) return 0;
  if (elapsedHours < 48) return 1;
  if (elapsedHours < 72) return 2;
  return 3;
}
```

**Test Fix**:
```javascript
// Manual test
const startedAt = new Date(Date.now() - 36 * 60 * 60 * 1000); // 36 hours ago
console.log(calculateCurrentDay(startedAt)); // Should output: 1
```

### Issue 4: Template Not Found

**Symptoms**:
- Logs show: "No template found for day X"
- Error count high
- Specific sequence ID fails consistently

**Diagnosis**:
```sql
-- Check if template has variants
SELECT id, name, status
FROM "SmsSequenceTemplate"
WHERE id = 'template-id';

SELECT id, day, variantCode, messageContent
FROM "SmsSequenceVariant"
WHERE sequenceId = 'template-id'
ORDER BY day, variantCode;
```

**Expected**:
- Template status = 'ACTIVE'
- At least 1 variant per day (variants for days 0-3)

**Solution**:
1. Create variants via UI or API
2. Ensure each day has at least variant "A"
3. Test with sample message:
   ```
   Template test message for {{name}} about {{product}}
   ```

### Issue 5: Cron Not Executing

**Symptoms**:
- Status endpoint shows: `nextRunAt` but nothing executed
- Vercel deployment logs show no cron execution
- Error logs completely empty

**Diagnosis**:

```bash
# Check Vercel cron logs
vercel logs --tail --filter cron

# Check if endpoint exists
curl -X POST https://your-domain.com/api/cron/sequence-dispatcher \
  -H "Content-Type: application/json"
```

**Expected**: HTTP 200 with metrics

**Solutions**:

1. **Verify vercel.json configuration**:
   ```json
   {
     "crons": [{
       "path": "/api/cron/sequence-dispatcher",
       "schedule": "*/5 * * * *"
     }]
   }
   ```

2. **Redeploy and wait**:
   ```bash
   git push origin main
   # Wait 5 minutes for next cron execution
   ```

3. **Test manually**:
   ```bash
   curl -X POST http://localhost:3000/api/cron/sequence-dispatcher \
     -H "Authorization: Bearer $(echo -n 'test' | base64)"
   ```

4. **Check Vercel dashboard**:
   - Vercel → Settings → Cron Jobs
   - Verify "sequence-dispatcher" is listed
   - Check last execution time

### Issue 6: Duplicate Messages Being Sent

**Symptoms**:
- Same contact receives Day 0 message twice
- SmsLog has duplicate entries
- `day0SentAt` is correct but two sends recorded

**Root Cause**: `shouldSendDay()` idempotency check failing

**Diagnosis**:
```sql
-- Check for duplicates in SmsLog
SELECT phone, COUNT(*) as count, MAX(sentAt) as last_sent
FROM "SmsLog"
WHERE channel = 'DAY_0_3_SEQUENCE'
  AND segmentCode = 'DAY0_SEQUENCE'
  AND phone = '010-XXXX-XXXX'
GROUP BY phone
HAVING COUNT(*) > 1;
```

**Solution**:

1. Verify `shouldSendDay()` logic is correct:
   ```typescript
   export function shouldSendDay(dayNumber: number, daysSent: (number | null)[]): boolean {
     if (daysSent && daysSent.includes(dayNumber)) {
       return false; // Already sent
     }
     return true;
   }
   ```

2. Ensure database update is atomic:
   ```typescript
   await updateSequenceProgress(instance.id, currentDay);
   ```

3. Clear duplicates (if needed):
   ```sql
   -- Delete duplicate sends (keep most recent)
   DELETE FROM "SmsLog"
   WHERE id NOT IN (
     SELECT DISTINCT ON (phone, segmentCode) id
     FROM "SmsLog"
     WHERE channel = 'DAY_0_3_SEQUENCE'
     ORDER BY phone, segmentCode, sentAt DESC
   );
   ```

### Issue 7: Memory or Timeout Errors

**Symptoms**:
- Logs show: "Task timed out" or "Allocation failed"
- Execution metrics: `elapsedMs > 60000`
- Error in recent deploys

**Diagnosis**:

```typescript
// Check batch size (in sequence-batch-processor.ts)
export async function processActiveSequences(
  organizationId: string,
  batchSize: number = 10, // Increase if timeout
  maxPerRun: number = 100  // Decrease if OOM
)
```

**Solutions** (in order):

1. **Reduce batch size**:
   ```typescript
   // Before
   processActiveSequences(orgId, 10, 100)
   
   // After (reduce parallel processing)
   processActiveSequences(orgId, 5, 50)
   ```

2. **Reduce max per run**:
   ```typescript
   // Before
   processActiveSequences(orgId, 10, 100)
   
   // After (fewer contacts per execution)
   processActiveSequences(orgId, 10, 50)
   ```

3. **Increase Vercel function memory**:
   - Vercel dashboard → Settings → Functions
   - Set memory to 3008 MB (max)

4. **Monitor with logging**:
   ```typescript
   logger.log('[batch-processor] Memory check', {
     heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
     heapTotal: process.memoryUsage().heapTotal / 1024 / 1024
   });
   ```

## Performance Tuning

### Optimize Batch Size

**Rule of thumb**: Batch Size = 10, increase if:
- Execution time < 5 seconds → increase to 15-20
- Execution time > 20 seconds → decrease to 5-8

```bash
# Monitor execution time trend
curl http://localhost:3000/api/admin/sequence-cron-status | \
  jq '.health[] | select(.active > 0)'
```

### Optimize Database Queries

**Current indexes**:
- `idx_instance_org_status_next_send`: For main cron query
- `idx_instance_next_send_cron`: Alternative for next_send lookups

**Add if slow**:
```sql
-- If contactId lookups are slow
CREATE INDEX idx_instance_contact_id ON "ContactSequenceInstance" (contactId);

-- If organization filters are slow
CREATE INDEX idx_instance_org_status ON "ContactSequenceInstance" (organizationId, status);
```

### Optimize Aligo API

**Current**: Sequential sends per batch
**Improvement**: Batch SMS API endpoint (if available)

```typescript
// Check Aligo docs for bulk_send endpoint
// Could reduce from 100 API calls to 1-2 calls per batch
```

## Debug Mode

### Enable Verbose Logging

```typescript
// In sequence-dispatcher/route.ts
const DEBUG = true;

if (DEBUG) {
  logger.log('[sequence-dispatcher] Detailed debug', {
    instanceDetails: instances.map(i => ({
      id: i.id,
      currentDay: calculateCurrentDay(i.createdAt),
      daysSent: [i.day0SentAt ? 0 : null, ...].filter(d => d !== null)
    }))
  });
}
```

### Manual Test Flow

```bash
# 1. Create test sequence
curl -X POST http://localhost:3000/api/playbook/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Sequence",
    "psychologyLens": "L0",
    "days": [{
      "day": 0,
      "variants": [{
        "code": "A",
        "message": "Test Day 0 for {{name}}"
      }]
    }]
  }'

# 2. Deploy to test contact
curl -X POST http://localhost:3000/api/playbook/sequences/:id/deploy \
  -H "Content-Type: application/json" \
  -d '{"contactIds": ["test-contact-id"]}'

# 3. Run cron manually
curl -X POST http://localhost:3000/api/cron/sequence-dispatcher

# 4. Check results
curl http://localhost:3000/api/admin/sequence-cron-status
```

## Getting Help

### Log Files to Review

1. **CloudWatch Logs**:
   - Search: `[sequence-dispatcher]` or `[batch-processor]`
   - Time range: Last 24 hours
   - Filter: ERROR or WARN

2. **Database Logs**:
   - Query slowlog (if >5 seconds)
   - Transaction logs for locks

3. **Aligo Logs**:
   - API response codes
   - Rate limiting info

### Contact Support

Include when reporting issues:
- Exact error message from logs
- Timestamp of occurrence
- Affected contact/sequence IDs
- Recent configuration changes
- Current metrics (sent/error count)

