# SMS A/B Test System - Implementation Guide

**Status**: Ready for Migration  
**Date**: 2026-05-27  
**Target Deployment**: 2026-05-28

---

## Files Created

### 1. Schema Changes
**File**: `prisma/schema.prisma`

**New Models**:
- `SmsLog` (Enhanced with A/B test fields)
  - `abTestId`: Link to test
  - `abTestGroup`: "A" | "B" assignment
  - `openedAt`, `clickedAt`, `convertedAt`, `responseAt`: Event tracking
  - `segmentCode`, `psychologyLens`: Context metadata

- `SmsABTest` (Master test configuration)
  - Test metadata: name, objective, psychology lens, copy angle
  - Variant templates: variantATemplate, variantBTemplate
  - Configuration: testDays, minSampleSize, pValueThreshold
  - Results tracking: declaredWinner, declaredAt

- `SmsABTestResult` (Aggregated metrics per group)
  - Counts: totalSent, totalOpened, totalClicked, totalConverted
  - Rates: openRate, clickRate, conversionRate, responseRate
  - Statistics: chiSquare, zScore, pValue, confidence intervals
  - Effect sizes: relativeRisk, oddsRatio, isStatSig

- `SmsABTestTimeline` (Daily snapshots)
  - Captures metrics at specific times
  - Enables trend visualization
  - Auto-generated insights per day

**Migration Steps**:
```bash
# 1. Backup current schema
pg_dump mabiz-crm > backup-2026-05-27.sql

# 2. Generate migration
npx prisma migrate dev --name add_sms_ab_test_system

# 3. Run migration
npx prisma migrate deploy

# 4. Verify schema
npx prisma db push
```

### 2. Statistics Library
**File**: `src/lib/analytics/sms-ab-test-statistics.ts`

**Exports**:
- `analyzeABTest()`: Main analysis function
- `calculateSampleSize()`: Determine required N
- `formatABTestResult()`: Pretty-print results
- `calculateSnapshot()`: Time-series snapshot
- `chiSquareTest()`: χ² test
- `twoProportionZTest()`: Z-test
- `wilsonScoreCI()`: Confidence intervals
- `calculateRelativeRisk()`, `calculateOddsRatio()`: Effect sizes

**No External Dependencies**:
- Pure TypeScript/Math
- Uses built-in `Math` library
- Compatible with Node.js runtime

**Testing**:
```bash
# Test statistics module
npx jest src/lib/analytics/sms-ab-test-statistics.test.ts
```

### 3. API Endpoint
**File**: `src/app/api/sms-ab-tests/route.ts`

**Endpoints**:
- `GET /api/sms-ab-tests` - Fetch test data with live calculations
- `POST /api/sms-ab-tests` - Create new test

**Features**:
- Real-time aggregation from SmsLog
- Statistical calculations on-the-fly
- 95% confidence interval computation
- Auto-generated recommendations

### 4. Dashboard Component
**File**: `src/app/(dashboard)/sms-logs/components/ab-test-dashboard.tsx`

**Features**:
- Test selection dropdown
- A vs B comparison table (all key metrics)
- Statistical results panel (χ², z, p-value, RR, OR)
- Template side-by-side viewer
- Auto-generated recommendation section
- Date range filter (1, 3, 7, 14, 30 days)

**UI Patterns**:
- Uses cruisedot_ui_patterns: table, badge, status indicators
- Green/red highlighting for better/worse performance
- Icons for significance: ✅ (sig), ⚠️ (trend), ➡️ (no diff)

### 5. Updated SMS Logs Page
**File**: `src/app/(dashboard)/sms-logs/page.tsx`

**Changes**:
- Added tab navigation: "SMS 발송 로그" | "A/B 테스트 분석"
- Integrated ABTestDashboard component
- Fetch organization ID from `/api/auth/me`
- Conditional rendering based on active tab

---

## Integration Points

### 1. SMS Sending Flow
When sending A/B test SMS:

```typescript
// In sms-sender.ts or equivalent
const abTestId = "test_123";
const abTestGroup = Math.random() > 0.5 ? "A" : "B";

await prisma.smsLog.create({
  data: {
    organizationId,
    contactId,
    phone,
    contentPreview: variant[abTestGroup].template,
    status: "SENT",
    sentAt: new Date(),
    abTestId,
    abTestGroup,
    segmentCode: contact.segmentCode,
    psychologyLens: test.psychologyLens
  }
});
```

### 2. Event Tracking
When SMS events occur:

```typescript
// SMS opened (webhook from SMS provider or tracking pixel)
await prisma.smsLog.update({
  where: { id: logId },
  data: { openedAt: new Date() }
});

// Link clicked
await prisma.smsLog.update({
  where: { id: logId },
  data: { clickedAt: new Date() }
});

// Purchase completed (webhook from e-commerce)
await prisma.smsLog.update({
  where: { id: logId },
  data: { convertedAt: new Date() }
});
```

### 3. Daily Snapshot (Cron Job)
Create `src/jobs/sms-ab-test-snapshot.ts`:

```typescript
export async function snapshotABTests() {
  const activeTests = await prisma.smsABTest.findMany({
    where: { status: "ACTIVE" }
  });

  for (const test of activeTests) {
    const logs = await prisma.smsLog.findMany({
      where: {
        abTestId: test.id,
        sentAt: { gte: test.startedAt }
      }
    });

    const groupA = logs.filter(l => l.abTestGroup === "A");
    const groupB = logs.filter(l => l.abTestGroup === "B");

    const dayNumber = Math.floor(
      (Date.now() - test.startedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    const result = analyzeABTest(
      groupA.filter(l => l.convertedAt).length,
      groupA.length,
      groupB.filter(l => l.convertedAt).length,
      groupB.length,
      dayNumber
    );

    // Create timeline snapshot
    await prisma.smsABTestTimeline.create({
      data: {
        abTestId: test.id,
        organizationId: test.organizationId,
        snapshotDate: new Date(),
        dayNumber,
        groupA_sent: groupA.length,
        groupA_converted: groupA.filter(l => l.convertedAt).length,
        groupB_sent: groupB.length,
        groupB_converted: groupB.filter(l => l.convertedAt).length,
        pValue: result.pValue,
        isSignificant: result.isStatisticallySignificant,
        recommendation: result.recommendation
      }
    });
  }
}

// Add to cron scheduler
schedule("0 0 * * *", snapshotABTests); // Daily at midnight
```

---

## Data Migration Strategy

### Option 1: Fresh Start (Recommended)
- Create new A/B tests from scratch
- No data migration needed
- Clean, well-tracked datasets
- Recommended if < 10 active tests

### Option 2: Backfill Historical Data
If you have existing SMS logs to analyze:

```typescript
// Backfill A/B test fields from metadata
// E.g., if SMS template names indicate variant
const logs = await prisma.smsLog.findMany({
  where: {
    contentPreview: { contains: "variant_a" }
  }
});

for (const log of logs) {
  await prisma.smsLog.update({
    where: { id: log.id },
    data: {
      abTestId: "test_legacy_001",
      abTestGroup: "A"
    }
  });
}
```

---

## Testing Checklist

### Unit Tests
- [ ] `sms-ab-test-statistics.ts`
  - Chi-square test calculation
  - Z-test with edge cases (0 conversions, etc.)
  - Confidence interval bounds
  - Relative risk and odds ratio
  - Sample size calculation

### Integration Tests
- [ ] `GET /api/sms-ab-tests` endpoint
  - Fetch tests for organization
  - Correct metric aggregation
  - Real-time calculation accuracy
  - Pagination working

- [ ] `POST /api/sms-ab-tests` endpoint
  - Create new test
  - Initialize result records
  - Validate required fields

### Component Tests
- [ ] ABTestDashboard
  - Test selection dropdown works
  - Metrics display correctly
  - Significance indicator shows/hides
  - Date range filter updates data
  - Recommendation text renders

### End-to-End Tests
1. Create A/B test via API
2. Send SMS with abTestId and abTestGroup
3. Mark some as opened/clicked/converted
4. Check dashboard displays correct metrics
5. Verify statistical calculations

---

## Deployment Checklist

### Pre-Deployment
- [ ] Review schema changes
- [ ] Test migration in staging
- [ ] Run full test suite
- [ ] Performance test with 10K+ SmsLog records
- [ ] Security review: PII handling in logs
- [ ] Documentation complete

### Deployment Steps
1. **Backup database**
   ```bash
   pg_dump mabiz-crm > backup-2026-05-27-pre-deploy.sql
   ```

2. **Run migration**
   ```bash
   npx prisma migrate deploy
   ```

3. **Verify schema**
   ```bash
   npx prisma db push --skip-generate
   ```

4. **Deploy API endpoint**
   ```bash
   git add src/app/api/sms-ab-tests/route.ts
   git commit -m "feat(sms): Add A/B test analytics API"
   git push
   ```

5. **Deploy component**
   ```bash
   git add src/app/'(dashboard)'/sms-logs/
   git commit -m "feat(sms): Add A/B test analysis dashboard"
   git push
   ```

6. **Smoke test**
   - Create test A/B test
   - Verify API returns data
   - Check dashboard renders

7. **Monitor**
   - Watch database query performance
   - Monitor API response times
   - Check for any errors in logs

### Post-Deployment
- [ ] Enable A/B test creation in UI (if not already)
- [ ] Announce feature to team
- [ ] Provide training on usage
- [ ] Collect feedback

---

## Performance Considerations

### Query Optimization
```sql
-- Ensure these indexes exist
CREATE INDEX idx_smslog_abtest_id ON "CrmSmsLog"("abTestId");
CREATE INDEX idx_smslog_group_date ON "CrmSmsLog"("abTestGroup", "sentAt");
CREATE INDEX idx_smslog_org_group ON "CrmSmsLog"("organizationId", "abTestGroup");
CREATE INDEX idx_smslog_segment ON "CrmSmsLog"("segmentCode") WHERE "abTestGroup" IS NOT NULL;
```

### Expected Performance
- **Fetch 1 test**: < 100ms
- **Analyze test (10K logs)**: < 500ms
- **List all tests (50 tests)**: < 1s
- **Timeline snapshots (100 per test)**: < 2s

### Optimization Tips
1. Limit date range in queries (use 30 days default)
2. Cache statistics for completed tests
3. Use materialized views for frequently accessed aggregations
4. Batch snapshot creation (process multiple tests in one job)

---

## Rollback Plan

If issues occur:

```bash
# Rollback to previous migration
npx prisma migrate resolve --rolled-back add_sms_ab_test_system

# Restore from backup
psql mabiz-crm < backup-2026-05-27-pre-deploy.sql

# Revert code changes
git revert <commit-hash>
```

---

## Documentation for Users

### Team Email
Subject: New Feature: SMS A/B Test Analysis Dashboard

Content:
```
Hello Team,

We're excited to announce the new SMS A/B Test Analysis Dashboard!

WHAT'S NEW:
- Compare SMS variants with statistical significance testing
- See real-time metrics: Open Rate, Click Rate, Conversion Rate
- Auto-generated recommendations (e.g., "Deploy B variant - 53% better")
- 95% confidence intervals to verify results
- Chi-square and Z-tests for statistical rigor

HOW TO USE:
1. Go to SMS Logs page
2. Click "A/B 테스트 분석" tab
3. Select test from dropdown
4. Review metrics and recommendation

TECHNICAL DETAILS:
- p-value < 0.05 indicates statistical significance
- Relative Risk: 1.53x means variant B is 53% better
- Confidence intervals show range of true value
- Minimum sample size: 100 per variant (configurable)

QUESTIONS?
Contact: [analytics team email]
Docs: [link to SMS_AB_TEST_SYSTEM.md]
```

---

## Next Steps

### Short-term (Week 1)
- Deploy A/B test system
- Enable test creation via API
- Monitor performance
- Collect team feedback

### Medium-term (Week 2-3)
- Create first A/B tests for Day 0/1/3 SMS variants
- Track results and iterate
- Train team on best practices

### Long-term (Month 1-3)
- Expand to email A/B tests
- Implement sequential testing (O'Brien-Fleming)
- Add multi-arm tests (3+ variants)
- Bayesian analysis option

---

**Version**: 1.0  
**Last Updated**: 2026-05-27  
**Status**: Ready to Deploy
