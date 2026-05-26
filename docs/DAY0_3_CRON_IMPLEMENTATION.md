# Day 0-3 Sequence Cron Implementation

## Overview

The Day 0-3 Sequence Cron system automates the sending of PASONA-based SMS messages over a 3-day period to contacts enrolled in sequences.

**Execution Schedule**: Every 5 minutes (288 times per day)  
**Performance Target**: Process 50-100 contacts per execution in <10 seconds  
**Reliability Target**: 99%+ success rate with graceful error handling

## Architecture

### Core Components

#### 1. **Sequence Lifecycle Service** (`sequence-lifecycle-service.ts`)
Manages the progression of sequences through days 0-3.

**Key Functions**:
- `calculateCurrentDay(startedAt: Date)` → Returns current day (0-3) based on elapsed time
- `shouldSendDay(dayNumber, daysSent)` → Checks if day should be sent (idempotency)
- `getSequenceDayTemplate(orgId, sequenceId, dayNumber, lensId)` → Retrieves message template
- `performSubstitution(template, contact, sequence)` → Replaces {{name}}, {{product}}, etc.
- `updateSequenceProgress(instanceId, dayNumber)` → Records sent timestamp
- `getActiveSequenceInstances(orgId, limit, offset)` → Fetches all active sequences

**Day Calculation Logic**:
```
Day 0: 0-24 hours after start
Day 1: 24-48 hours after start
Day 2: 48-72 hours after start
Day 3: 72+ hours after start
```

#### 2. **Batch Processor** (`sequence-batch-processor.ts`)
Handles parallel processing of message sends with error recovery.

**Key Functions**:
- `processActiveSequences(orgId, batchSize, maxPerRun)` → Main batch processing logic
- `processSequencesForOrg(orgId)` → Wrapper for cron execution
- Internal helpers for SMS sending and logging

**Processing Flow**:
1. Fetch active instances (default 100 per run)
2. Process in parallel batches (10 per batch)
3. For each instance:
   - Calculate current day
   - Check if day already sent (idempotency)
   - Fetch template
   - Perform substitution
   - Send SMS
   - Update progress on success
   - Log event (success/failure)
4. Return summary statistics

**Rate Limiting**: 10 parallel sends per batch to avoid overwhelming Aligo API

#### 3. **Completion Detector** (`sequence-completion-detector.ts`)
Monitors sequence completion status and handles lifecycle transitions.

**Key Functions**:
- `detectCompletions(orgId)` → Finds completed and failed sequences
- `getSequenceHealth(orgId)` → Returns summary statistics

**Completion Rules**:
- **COMPLETED**: All 4 days sent successfully
- **FAILED**: 7+ days elapsed without all days being sent
- **ACTIVE**: Still in progress (default state)
- **PAUSED**: Manually paused by user

#### 4. **Cron Endpoint** (`/api/cron/sequence-dispatcher`)
Main entry point for Vercel cron execution.

**Response**:
```json
{
  "ok": true,
  "requestId": "uuid",
  "metrics": {
    "sent": 45,
    "errors": 2,
    "completed": 12,
    "failed": 0,
    "organizationsProcessed": 3,
    "elapsedMs": 8234,
    "totalTimeMs": 8450
  },
  "health": {
    "org-id-1": {
      "active": 150,
      "completed": 890,
      "failed": 3,
      "paused": 0,
      "totalSent": 1043
    }
  }
}
```

#### 5. **Monitoring Endpoint** (`/api/admin/sequence-cron-status`)
Provides health check and debugging information.

**Available Data**:
- Cron schedule and next run time
- Organization health statistics
- Recent sequence activity
- Active sequence template performance

## Database Schema

### Key Tables

**ContactSequenceInstance**:
- `id`: Unique identifier
- `organizationId`: Organization
- `contactId`: Contact reference
- `sequenceId`: Template reference
- `day0SentAt` - `day3SentAt`: Send timestamps
- `day0OpenedAt` - `day3OpenedAt`: Open tracking
- `status`: ACTIVE | PAUSED | COMPLETED | FAILED
- `nextSendAt`: Calculated next send time
- `failureReason`: Reason for failure
- `createdAt`, `updatedAt`: Timestamps

**Indexes**:
- `idx_instance_org_status_next_send`: For cron queries
- `uq_contact_sequence`: Unique constraint (prevent duplicates)

**SmsSequenceTemplate**:
- Defines Day 0-3 sequence configuration
- Contains delay settings (minutes)
- Tracks performance metrics

**SmsSequenceVariant**:
- A/B test variants for each day
- Contains psychology framework tags
- Tracks engagement metrics per variant

## Message Template Variables

Supported placeholders for substitution:

| Variable | Source | Example |
|----------|--------|---------|
| `{{name}}` | Contact.name | "최민형" |
| `{{product}}` | Contact.productName or Template.productCode | "크루즈 골드" |
| `{{date}}` | Current date (ko-KR format) | "2026년 5월 27일" |
| `{{company}}` | Organization.name | "마비즈" |
| `{{phone}}` | Contact.phone | "010-1234-5678" |

**Example Message**:
```
안녕하세요, {{name}}님!

{{date}}에 예약하신 {{product}}는 곧 출발합니다.
마지막 체크리스트를 확인하셨나요?

궁금한 점은 {{company}}로 연락주세요.
```

## PASONA Framework Mapping

Each day maps to a specific PASONA stage:

| Day | Stage | Name | Description | Psychology |
|-----|-------|------|-------------|------------|
| 0 | P+A | Problem + Agitate | Define problem + Create urgency | Grant Cardone L6 (타이밍) + L10 (즉시구매) |
| 1 | S | Solution | Present solution | Grant Cardone L1-L5 (이의 대응) |
| 2 | O | Offer | Present offer/value | Russell Brunson (스토리) + 신뢰 신호 |
| 3 | N | Action + Narrow | Call to action + limit options | Grant Cardone L10 (클로징) + 긴박감 |

## Performance Characteristics

### Expected Throughput

**Per 5-minute execution**:
- ~50-100 contacts (varies by batch processing)
- ~8-12 second average execution time
- <10 second target

**Per day** (288 executions):
- ~14,400 - 28,800 potential contacts reached
- Distributed throughout the day

### Resource Usage

- **Database Queries**: ~5-10 per contact
- **API Calls**: 1 per contact (Aligo SMS)
- **Memory**: <50MB per execution
- **Network**: ~1-5 requests to Aligo per second

### Error Rates

**Target**: <2% error rate
- Network failures: Automatic retry on next execution
- Invalid phones: Logged and skipped
- Template missing: Logged, contact skipped
- Opt-outs: Respected, contact skipped

## Error Handling

### Retry Logic

**Automatic Retries**:
- Network failures: Retry on next execution (5 min later)
- Rate limits: Exponential backoff (skip batch, continue)
- Database errors: Log and continue with next contact

**No Automatic Retries** (marked as failed):
- Invalid phone number
- Contact deleted
- Sequence template deleted
- Opt-out status

### Error Logging

All errors are logged with:
- Timestamp
- Contact ID
- Instance ID
- Day number
- Error message
- Stack trace (if applicable)

**Log Location**: CloudWatch / Logger service

## Configuration

### Vercel cron.json

```json
{
  "crons": [{
    "path": "/api/cron/sequence-dispatcher",
    "schedule": "*/5 * * * *"
  }]
}
```

### Environment Variables Required

- `ALIGO_API_KEY`: Aligo SMS provider key
- `ALIGO_USER_ID`: Aligo user ID
- `ALIGO_SENDER_PHONE`: Sender phone number

## Monitoring & Observability

### Health Check Endpoint

```bash
GET /api/admin/sequence-cron-status
```

Returns:
- Cron schedule info
- Organization health stats
- Recent activity
- Active sequences with performance metrics

### Key Metrics to Monitor

1. **Sent Count**: Messages successfully sent
2. **Error Count**: Failed sends
3. **Completion Rate**: Sequences reaching all 4 days
4. **Failure Rate**: Sequences marked as failed
5. **Execution Time**: Cron execution duration
6. **Queue Depth**: Pending sequences

### Alerting Rules

- **Critical**: Error rate >5% or no executions in 15 minutes
- **Warning**: Error rate >2% or execution time >30 seconds
- **Info**: Daily summary of sends/completions

## Testing

### Unit Tests

Located in `__tests__/sequence-lifecycle.test.ts`:

```bash
npm test -- sequence-lifecycle.test.ts
```

Tests cover:
- Day calculation (boundaries)
- Substitution logic
- Completion detection
- Failure detection

### Integration Tests

Manual testing steps:

1. **Create test sequence**:
   - Create SmsSequenceTemplate with test variants
   - Create ContactSequenceInstance for test contact

2. **Manual cron execution**:
   ```bash
   curl -X POST http://localhost:3000/api/cron/sequence-dispatcher \
     -H "Authorization: Bearer test-token"
   ```

3. **Verify results**:
   - Check ContactSequenceInstance.day0SentAt
   - Check SmsLog for sent message
   - Monitor response metrics

4. **Check health**:
   ```bash
   curl http://localhost:3000/api/admin/sequence-cron-status
   ```

## Troubleshooting

### High Error Rate

**Symptoms**: Error count >5% in metrics

**Diagnosis**:
1. Check Aligo API status
2. Verify ALIGO_API_KEY and credentials
3. Check phone number format validation
4. Review CloudWatch logs for specific errors

**Resolution**:
- Fix credentials → Errors auto-recover on next execution
- Fix phone format → Rebuild contacts
- Contact Aligo support if API is down

### Messages Not Sending

**Symptoms**: Sent count stays at 0

**Diagnosis**:
1. Check if sequences have status='ACTIVE'
2. Verify ContactSequenceInstance.status='ACTIVE'
3. Check template variants exist
4. Verify phone numbers are valid

**Resolution**:
- Activate sequences via UI
- Create sequence instances
- Check template setup

### Slow Execution

**Symptoms**: Execution time >30 seconds

**Diagnosis**:
1. Check database connection pool
2. Monitor Aligo API latency
3. Check batch size settings
4. Review concurrent connections

**Resolution**:
- Increase database connection pool
- Reduce batch size (10 → 5)
- Contact Aligo for performance issues

## Future Enhancements

### Planned Improvements

1. **A/B Testing**: Automatic winner detection and rollout
2. **Dynamic Delays**: ML-based optimal send times per segment
3. **Webhooks**: Real-time events (sent, opened, clicked, converted)
4. **Analytics Dashboard**: Per-sequence performance tracking
5. **Predictive Completion**: Forecast sequence completion rates
6. **Multi-channel**: Email/Kakao integration
7. **Smart Retries**: ML-based retry strategy per contact

### Known Limitations

- Single-day granularity (no intra-day scheduling)
- No timezone awareness (all in UTC)
- Manual sequence activation (no auto-trigger yet)
- Limited A/B variant support (basic winner selection)

## References

- PASONA Framework: See `CLAUDE_RAG_INDEX.md` → [[pasona_framework_complete]]
- Grant Cardone 10 Lenses: See `CLAUDE_RAG_INDEX.md` → [[grant_cardone_closing]]
- Sequence Types: See `src/lib/types/sequence.ts`
- Sequence Service: See `src/lib/services/sequence-service.ts`

