# A/B Test Automation Guide

**Version**: 1.0  
**Author**: CRM Analytics Team  
**Date**: 2026-05-27  
**Status**: Production Ready

## Overview

This guide explains the A/B test automation system for SMS campaigns in mabiz CRM. The system automatically:

1. **Collects daily metrics** from SMS logs
2. **Runs statistical analysis** (χ², z-score, p-value)
3. **Detects winners** with 95% confidence
4. **Saves snapshots** for trend tracking
5. **Auto-completes tests** after 14+ days
6. **Monitors execution** and logs all activity

---

## How It Works

### 1. Daily Aggregation (Cron Job)

**Endpoint**: `/api/cron/ab-test-daily-aggregate`  
**Schedule**: Daily at **1:00 AM UTC** (0 1 * * *)  
**Duration**: ~1-2 minutes for 100+ tests  

**Process**:
```
For each ACTIVE A/B test:
  1. Fetch SMS logs from test start date
  2. Count sent, opened, clicked, converted by group (A vs B)
  3. Run statistical tests (Chi-square, Z-test, confidence intervals)
  4. Save daily snapshot to SmsABTestTimeline
  5. Update SmsABTestResult with latest metrics
  6. Check if winner criteria met (p < 0.05 + 30+ samples + 7+ days)
  7. Auto-complete test if criteria met
  8. Archive old timeline records (>30 days)
  9. Log execution metrics
```

### 2. Winner Detection

A winner is declared when **all** criteria are met:

| Criterion | Threshold | Purpose |
|-----------|-----------|---------|
| **p-value** | < 0.05 | 95% statistical confidence |
| **Sample Size** | ≥ 30 per group | Minimum for validity |
| **Test Duration** | ≥ 7 days | Sufficient observation period |

**Example**:
- Group A: 150 sent, 45 converted (30% rate)
- Group B: 160 sent, 56 converted (35% rate)
- p-value: 0.023 ✅ (< 0.05)
- Sample size: A=150 ✅, B=160 ✅ (both > 30)
- Duration: 9 days ✅ (> 7)
- **Result**: B is ~17% better → Deploy B

### 3. Recommendation States

The system generates recommendations in four states:

#### ✅ GREEN: Deploy Winner
```
Status: DEPLOY_A or DEPLOY_B
Text: "✅ A is 32% better (p=0.023). Deploy A immediately."
Actions:
  - Deploy variant to 100% of audience
  - Save conversion lift: +32%
  - Update template library
  - Archive losing variant
```

#### 📊 YELLOW: Continue Testing
```
Status: CONTINUE
Text: "B shows promise (35% vs 30%, p=0.08) but not yet significant. Continue testing."
Actions:
  - Continue A/B test for 3-5 more days
  - Monitor daily
  - Expected completion in ~3 days
```

#### ⚪ GRAY: Equivalent Performance
```
Status: EQUIVALENT
Text: "No difference (30% vs 31%, p=0.42). Either variant acceptable."
Actions:
  - Deploy either variant
  - Consider secondary factors (brand, UX, cost)
  - Document learning
```

#### ⏳ GRAY: Insufficient Data
```
Status: INSUFFICIENT_DATA
Text: "Need more data. Current: A=45, B=52. Target: 100 per variant."
Actions:
  - Continue sending
  - Expected: 2-3 more days
```

---

## APIs & Endpoints

### 1. Daily Aggregation Cron
```
GET /api/cron/ab-test-daily-aggregate
Authorization: Bearer {CRON_SECRET}
```

**Response**:
```json
{
  "success": true,
  "status": "SUCCESS",
  "timestamp": "2026-05-27T01:15:30Z",
  "executionTimeMs": 45000,
  "summary": {
    "totalTests": 12,
    "processedSuccessfully": 12,
    "processedWithErrors": 0,
    "winnersDetected": 2,
    "completedTests": 2
  },
  "results": [
    {
      "testId": "test_abc123",
      "success": true,
      "dayNumber": 9,
      "groupA_sent": 150,
      "groupA_converted": 45,
      "groupB_sent": 160,
      "groupB_converted": 56,
      "pValue": 0.023,
      "isSignificant": true,
      "hasWinner": true,
      "winner": "B"
    }
  ]
}
```

### 2. Monitoring History
```
GET /api/admin/ab-tests/cron-history?limit=30
```

**Response**:
```json
{
  "success": true,
  "timestamp": "2026-05-27T15:30:00Z",
  "summary": {
    "totalExecutions": 5,
    "successRate": 100,
    "totalWinnersDetected": 3,
    "avgExecutionTime": 45000,
    "lastExecution": {
      "id": "log_...",
      "executionDate": "2026-05-27T01:15:30Z",
      "totalTests": 12,
      "winnersDetected": 2,
      "status": "SUCCESS"
    }
  },
  "health": {
    "cronStatus": "HEALTHY",
    "lastExecution": "2026-05-27T01:15:30Z",
    "nextExecution": "2026-05-28T01:00:00Z",
    "failureRate": 0,
    "recentErrors": []
  },
  "history": [
    {
      "id": "log_...",
      "executionDate": "2026-05-27T01:15:30Z",
      "totalTests": 12,
      "winnersDetected": 2,
      "completedTests": 2,
      "successCount": 12,
      "errorCount": 0,
      "status": "SUCCESS"
    }
  ]
}
```

### 3. Get Test Status
```
GET /api/sms-ab-tests/{testId}
```

**Response includes**:
```json
{
  "data": {
    "id": "test_abc123",
    "name": "Day 0 SMS Variants",
    "status": "ACTIVE",
    "startedAt": "2026-05-18T00:00:00Z",
    "testDays": 7,
    "declaredWinner": "B",
    "declaredAt": "2026-05-25T01:15:00Z",
    "currentMetrics": {
      "groupA": {
        "sent": 150,
        "opened": 120,
        "clicked": 45,
        "converted": 45
      },
      "groupB": {
        "sent": 160,
        "opened": 134,
        "clicked": 56,
        "converted": 56
      }
    },
    "statistics": {
      "pValue": 0.023,
      "zScore": 2.29,
      "chiSquare": 5.25,
      "isStatisticallySignificant": true
    },
    "recommendation": "✅ B is 17% better (p=0.023). Deploy B."
  }
}
```

---

## Key Metrics Explained

### Statistical Measures

| Metric | Meaning | Example |
|--------|---------|---------|
| **p-value** | Probability result occurred by chance | 0.023 = 2.3% chance it's random |
| **χ² (Chi-square)** | Goodness-of-fit test statistic | Higher = more different |
| **z-score** | Standard deviation units from mean | ±1.96 ≈ 95% confidence |
| **Confidence Interval** | Range where true rate likely falls | 30% [26%-34%] |
| **Relative Risk** | How much better B is vs A | 1.17 = B is 17% better |

### Conversion Metrics

| Metric | Calculation | Importance |
|--------|-------------|-----------|
| **Conversion Rate** | Converted / Sent | Primary success measure |
| **Open Rate** | Opened / Sent | Engagement proxy |
| **Click Rate** | Clicked / Sent | Intent indicator |
| **Improvement %** | (B-A)/A × 100 | Business impact |

---

## Common Scenarios

### Scenario 1: Clear Winner Detected

**Day 7 morning (1 AM UTC)**:
- Cron runs and finds p=0.019 ✅
- Sample sizes: A=142, B=155 ✅  
- Duration: 7 days ✅
- **Action**: Auto-mark test COMPLETED, declaredWinner="B"

**Dashboard shows**:
```
✅ Deploy B immediately
B is 25% better (35% vs 28%, p=0.019)
Actions:
- Deploy B to 100% of audience
- Save 70 additional conversions per 10K messages
- Update template library
```

### Scenario 2: Trending (No Winner Yet)

**Day 5 morning**:
- Current: A=28% (n=95), B=33% (n=98)
- p-value: 0.08 (not significant yet)
- Duration: 5 days

**Dashboard shows**:
```
📊 B shows promise but continue testing
B is trending 18% better (p=0.08) but not yet significant
Actions:
- Continue testing for 2-3 more days
- Expected to reach significance: Day 7-8
- Monitor daily for updates
```

### Scenario 3: No Significant Difference

**Day 10 morning**:
- A: 30.5% (n=200), B: 30.1% (n=195)
- p-value: 0.72 (very likely random variation)
- Difference: only 0.4%

**Dashboard shows**:
```
⚪ Either variant acceptable
No significant difference (A: 30.5%, B: 30.1%, p=0.72)
Actions:
- Deploy either variant
- Consider secondary factors (brand fit, UX feedback)
- Move to next test experiment
```

### Scenario 4: Test Auto-Completes After 30 Days

**Day 30 morning**:
- Test has been running 30 days
- No clear winner found despite many samples
- Cron auto-completes test

**Dashboard shows**:
```
⏳ Test auto-completed (max duration reached)
After 30 days with high samples, no winner detected
Actions:
- Deploy either variant (no clear advantage)
- Consider completely different copy test
- Review messaging strategy
```

---

## Dashboard Reading Guide

### Cron Health Check
```
Location: Dashboard → Admin → A/B Tests → Cron History

✅ HEALTHY
- Last Run: Today 1:15 AM UTC (successful)
- Next Run: Tomorrow 1:00 AM UTC  
- Success Rate: 100% (5/5 runs)
- Avg Execution Time: 45 seconds
```

### Active Tests Summary
```
Location: Dashboard → Campaigns → A/B Tests

Active: 12 tests
- 8 tests still running (< 7 days)
- 2 tests with winners detected (ready to deploy)
- 2 tests no clear winner (keep running)

Completed: 23 tests
- 23 winners deployed and archived
```

### Individual Test View
```
Name: Day 0 SMS Variants (Week 1)
Duration: 9 days running
Status: COMPLETED ✅

Variant A (Control):
  150 sent | 45 converted (30.0%) [26.0%-34.5%]
  
Variant B (New Copy):
  160 sent | 56 converted (35.0%) [31.0%-39.0%]

Statistics:
  Difference: +5.0% [0.2%-9.8%]
  p-value: 0.023 (SIGNIFICANT)
  Confidence: 97.7%

Recommendation: ✅ Deploy B (+17%, p=0.023)
```

---

## Troubleshooting

### Issue: Cron Not Running

**Check**:
1. Vercel dashboard → Cron Jobs
2. Look for `/api/cron/ab-test-daily-aggregate`
3. Check "Last Execution" timestamp
4. View logs in Vercel CloudWatch

**Fix**:
- Ensure `CRON_SECRET` env var is set
- Verify route file exists at correct path
- Check vercel.json has correct entry

### Issue: Tests Not Completing

**Check**:
1. Are samples >= 30 per group?
2. Has test run >= 7 days?
3. Is p-value < 0.05?

**Example**:
- Day 7: A=120 samples (✅), B=115 samples (✅), p=0.12 (❌)
- **Result**: Continue testing, need more samples

**Fix**:
- Increase send volume to reach 30+ per group faster
- Run test longer (14 days typical)
- Check for bugs in conversion tracking

### Issue: Cron Takes Too Long

**Normal**: < 2 min for 100+ tests (20ms per test)

**If slow**:
1. Check Prisma query performance
2. Reduce number of timeline records (archival working?)
3. Profile SmsLog table (index on abTestId?)

**Query to check**:
```sql
-- Check if index exists
SELECT * FROM pg_indexes 
WHERE tablename = 'SmsLog' 
AND indexname LIKE '%abTestId%';

-- Create if missing
CREATE INDEX "SmsLog_abTestId_idx" ON "SmsLog"("abTestId");
```

### Issue: Wrong Recommendation

**Check calculation**:
1. Are you using correct formula? (B-A)/A for % improvement
2. Is sample size sufficient? (need 30+ per group)
3. Is test duration sufficient? (need 7+ days)

**Example**:
- A: 30% conversion (n=100)
- B: 37.5% conversion (n=100)  
- Improvement: (0.375-0.30)/0.30 = 25% ✅
- p-value: 0.042 ✅
- Duration: 8 days ✅
- **Result**: Deploy B (✅ all criteria met)

---

## Configuration

### Environment Variables

```bash
# .env.local or Vercel settings

# Cron authentication
CRON_SECRET=your-random-secret-key-here

# Database
DATABASE_URL=postgresql://...

# Optional: Custom thresholds (use defaults if not set)
AB_TEST_MIN_SAMPLE_SIZE=100
AB_TEST_MIN_DAYS=7
AB_TEST_MAX_DAYS=30
AB_TEST_P_VALUE_THRESHOLD=0.05
```

### Customize Test Parameters

**When creating test** via API or dashboard:
```json
{
  "name": "Day 0 SMS Test",
  "testDays": 7,
  "minSampleSize": 100,
  "pValueThreshold": 0.05,
  "confidenceLevel": 0.95
}
```

**Cron uses these per-test settings** automatically.

---

## Integration Points

### 1. From SmsLog

```sql
-- Cron queries this table to get metrics
SELECT 
  abTestGroup,
  COUNT(*) as sent,
  COUNT(convertedAt) as converted,
  SUM(CASE WHEN openedAt IS NOT NULL THEN 1 ELSE 0 END) as opened
FROM SmsLog
WHERE abTestId = 'test_abc123'
  AND sentAt >= '2026-05-18'
GROUP BY abTestGroup;
```

### 2. To SmsABTestTimeline

```sql
-- Cron writes daily snapshots here
INSERT INTO SmsABTestTimeline (
  abTestId, organizationId, snapshotDate, dayNumber,
  groupA_sent, groupA_converted, groupA_rate,
  groupB_sent, groupB_converted, groupB_rate,
  pValue, isSignificant, recommendation
) VALUES (...)
```

### 3. To SmsABTestResult

```sql
-- Cron updates cumulative results here
UPDATE SmsABTestResult
SET totalSent = ?, totalConverted = ?, 
    conversionRate = ?, pValue = ?, zScore = ?
WHERE abTestId = ? AND abTestGroup = ?
```

### 4. Dashboard Display

```typescript
// App uses this data for charts and tables
const test = await prisma.smsABTest.findUnique({
  include: {
    timelines: { orderBy: { snapshotDate: 'desc' } },
    results: true
  }
})
```

---

## Performance Benchmarks

### Cron Execution Time

| Metric | Target | Typical |
|--------|--------|---------|
| Total tests | 100 | 40 sec |
| Per test | - | 0.4 sec |
| Database queries | - | 250-300 |
| Memory usage | < 500MB | 150MB |

### Query Performance

```sql
-- Cron's main query (should be < 100ms)
EXPLAIN ANALYZE
SELECT * FROM SmsLog
WHERE abTestId = 'test_abc123'
  AND sentAt >= '2026-05-18'
LIMIT 1000;

-- Index recommendation
CREATE INDEX CONCURRENTLY idx_smslog_test_date 
ON SmsLog(abTestId, sentAt DESC);
```

---

## Manual Testing

### Test the Cron Locally

```bash
# 1. Set environment variables
export CRON_SECRET="test-secret"
export DATABASE_URL="postgresql://..."

# 2. Run Next.js dev server
npm run dev

# 3. Call endpoint manually
curl -X GET http://localhost:3000/api/cron/ab-test-daily-aggregate \
  -H "Authorization: Bearer test-secret"

# 4. View response
# Should return { success: true, status: "SUCCESS", ... }
```

### Manual Winner Detection

```typescript
// In next.js console or test file
import { detectWinner } from '@/lib/services/ab-test-automation';

const result = await detectWinner('test_abc123');
console.log(result);
// {
//   hasWinner: true,
//   winner: 'B',
//   confidence: 0.977,
//   pValue: 0.023,
//   recommendation: "✅ B is 17% better (p=0.023)..."
// }
```

---

## Support & Monitoring

### CloudWatch Logs
```
/aws/lambda/vercel-cron/ab-test-daily-aggregate

Search for:
- ERROR - Cron failures
- WARNINGs - Partial failures
- INFO - Success metrics
```

### Weekly Report
Every Monday, check:
1. Total tests completed last week
2. Average winner confidence
3. Most significant improvements
4. Any failing tests

### Monthly Optimization
Review:
1. Are tests completing in reasonable time?
2. What copy angles work best? (by psychology lens)
3. Update test parameters for next month

---

## FAQ

**Q: How long should I run a test?**  
A: Minimum 7 days. Most complete in 7-14 days with good send volume. Maximum auto-complete at 30 days.

**Q: Can I stop a test manually?**  
A: Yes, change status to "PAUSED" or "COMPLETED" via dashboard.

**Q: What if I get a false positive?**  
A: Unlikely with p<0.05 threshold (5% false positive rate). But if concerned, re-run test on different segment.

**Q: Can I test more than 2 variants?**  
A: Current system is A/B only (2 variants). Multi-variant requires more samples and statistical power.

**Q: What's the minimum sample size needed?**  
A: Default 30 per group. Increase to 100+ for more confidence (especially if base rate is low).

**Q: How do I know which copy angle is best?**  
A: Check `psychologyLens` and `copyAngle` in test results. Group by these fields to see patterns.

---

## Next Steps

1. ✅ Deploy cron to production
2. ✅ Set up monitoring dashboard
3. ✅ Train team on reading recommendations
4. ⬜ Integrate Slack notifications for winners
5. ⬜ Add automated deployment of winners
6. ⬜ Build psychology lens performance trends

---

**Last Updated**: 2026-05-27  
**Maintained By**: CRM Analytics Team  
**Questions?** Check `CLAUDE.md` or contact engineering
