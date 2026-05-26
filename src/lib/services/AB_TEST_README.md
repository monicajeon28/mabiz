# A/B Test Automation Services

**Version**: 1.0 Production  
**Author**: CRM Analytics Team  
**Date**: 2026-05-27

## Overview

Four specialized services handle A/B test automation:

### 1. **ab-test-automation.ts** (250 lines)
Detects winners and updates metrics.

```typescript
import { detectWinner, updateTestResults } from '@/lib/services/ab-test-automation';

// Detect if test has a winner
const result = await detectWinner('test_abc123');
// { hasWinner: true, winner: 'B', confidence: 0.977, pValue: 0.023 }

// Update test result metrics
await updateTestResults('test_abc123');
```

**Key Functions**:
- `detectWinner(testId)` - 3-criteria winner detection (p<0.05, n≥30, days≥7)
- `updateTestResults(testId)` - Save metrics to SmsABTestResult

### 2. **ab-test-recommendation.ts** (150 lines)
Generates actionable recommendations.

```typescript
import { generateRecommendation, RecommendationStatus } from '@/lib/services/ab-test-recommendation';

const rec = generateRecommendation(analysisResult, minSampleSize);
// { status: 'deploy-b', text: '✅ Deploy B (+25%, p=0.023)', actionItems: [...] }
```

**Recommendation States**:
- ✅ `DEPLOY_A` / `DEPLOY_B` - Winner detected (green)
- 📊 `CONTINUE` - Trending but not significant (yellow)
- ⚪ `EQUIVALENT` - No significant difference (gray)
- ⏳ `INSUFFICIENT_DATA` - Need more samples (gray)

### 3. **ab-test-lifecycle.ts** (100 lines)
Manages test lifecycle and database cleanup.

```typescript
import { checkTestExpiry, archiveOldTimelines } from '@/lib/services/ab-test-lifecycle';

// Auto-complete test if criteria met
const completion = await checkTestExpiry('test_abc123');
// { completed: true, reason: 'Winner declared: B', winner: 'B' }

// Archive old snapshots (keep 30 days)
const deleted = await archiveOldTimelines('test_abc123');
// 42 old records deleted
```

**Key Functions**:
- `checkTestExpiry(testId, minDays=14, maxDays=30)` - Auto-complete logic
- `archiveOldTimelines(testId, keepDays=30)` - Database maintenance
- `pauseInactiveTests()` - Mark unused tests as paused
- `getTestStatusSummary()` - Quick stats

### 4. **ab-test-monitoring.ts** (100 lines)
Tracks cron execution history and health.

```typescript
import { logCronExecution, getExecutionHistory, getHealthCheckData } from '@/lib/services/ab-test-monitoring';

// Log a cron execution
const log = logCronExecution({
  executionDate: new Date(),
  totalTests: 12,
  winnersDetected: 2,
  successCount: 12,
  errorCount: 0,
  status: 'SUCCESS'
});

// View last 30 executions
const history = getExecutionHistory(30);

// Get health status
const health = await getHealthCheckData();
// { cronStatus: 'HEALTHY', lastExecution: ..., nextExecution: ... }
```

---

## Integration with Cron

The daily cron (`/api/cron/ab-test-daily-aggregate`) uses all four services:

```typescript
// Pseudo-code from cron endpoint
for (const test of activeTests) {
  // 1. Automation: Get metrics and check winner
  const winner = await detectWinner(test.id);
  
  // 2. Recommendation: Generate user-friendly text
  const rec = generateRecommendation(analysis);
  
  // 3. Lifecycle: Auto-complete and cleanup
  await checkTestExpiry(test.id);
  await archiveOldTimelines(test.id);
  
  // 4. Monitoring: Log the execution
  logCronExecution({ ... });
}
```

---

## Key Interfaces

### WinnerDetectionResult
```typescript
interface WinnerDetectionResult {
  hasWinner: boolean;
  winner?: 'A' | 'B';
  confidence: number;        // 0-1
  pValue: number;
  sampleSizeA: number;
  sampleSizeB: number;
  conversionRateA: number;
  conversionRateB: number;
  improvementPercent?: number;
  recommendation: string;    // Human-readable text
  metadata?: {
    isSignificant: boolean;
    minSamplesMet: boolean;
    testDuration: number;
  };
}
```

### Recommendation
```typescript
interface Recommendation {
  status: RecommendationStatus;
  text: string;              // For display
  color: 'green' | 'yellow' | 'gray';
  actionItems: string[];     // Specific next steps
  nextSteps?: string;        // Summary of next action
}
```

### CronExecutionLog
```typescript
interface CronExecutionLog {
  id: string;
  executionDate: Date;
  totalTests: number;
  winnersDetected: number;
  completedTests: number;
  errorCount: number;
  successCount: number;
  avgExecutionTimeMs: number;
  failedTestIds: string[];
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  notes?: string;
}
```

---

## Usage Examples

### Example 1: Check if Test Has Winner
```typescript
import { detectWinner } from '@/lib/services/ab-test-automation';

try {
  const result = await detectWinner('test_day0_sms_week1');
  
  if (result.hasWinner) {
    console.log(`Deploy ${result.winner}! (${result.improvementPercent}% better)`);
  } else {
    console.log(`Continue testing (p=${result.pValue.toFixed(3)})`);
  }
} catch (error) {
  console.error('Error checking winner:', error);
}
```

### Example 2: Generate Dashboard Recommendation
```typescript
import { generateRecommendation } from '@/lib/services/ab-test-recommendation';
import { analyzeABTest } from '@/lib/analytics/sms-ab-test-statistics';

// Get analysis from statistics module
const analysis = analyzeABTest(45, 150, 60, 160, 9);

// Generate recommendation
const rec = generateRecommendation(analysis, 100);

// Display in UI
console.log(rec.text);           // "✅ Deploy B (+25%, p=0.023)"
console.log(rec.color);          // "green"
console.log(rec.actionItems);    // ["Deploy B to 100%", "Save template", ...]
```

### Example 3: Auto-Complete Test
```typescript
import { checkTestExpiry } from '@/lib/services/ab-test-lifecycle';

const completion = await checkTestExpiry('test_abc123', 14, 30);

if (completion.completed) {
  console.log(`Test completed with winner: ${completion.winner}`);
  // Send notification to team
  await notifyWinnerDetected(completion.winner, completion.reason);
}
```

### Example 4: Monitor Cron Health
```typescript
import { getHealthCheckData, getExecutionHistory } from '@/lib/services/ab-test-monitoring';

const health = await getHealthCheckData();

console.log(`Status: ${health.cronStatus}`);
console.log(`Last run: ${health.lastExecution}`);
console.log(`Next run: ${health.nextExecution}`);
console.log(`Failure rate: ${health.failureRate}%`);

const recent = getExecutionHistory(5);
recent.forEach(log => {
  console.log(`${log.executionDate}: ${log.totalTests} tests, ${log.winnersDetected} winners`);
});
```

---

## Testing

Run the comprehensive test suite:

```bash
npm test -- ab-test-automation
```

Tests cover:
- Statistical significance detection
- Recommendation generation
- Edge cases (0%, 100%, large n)
- Real-world scenarios
- Effect size calculations

---

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| detectWinner | 65-115ms | Includes SmsLog query |
| generateRecommendation | 5ms | Pure calculation |
| checkTestExpiry | 50-80ms | Database operations |
| archiveOldTimelines | 30-50ms | Batch delete |

**Total for 100 tests**: ~45 seconds (0.45s per test)

---

## Error Handling

All services include comprehensive error handling:

```typescript
try {
  const result = await detectWinner(testId);
} catch (error) {
  logger.error('[detectWinner]', { testId, error: error.message });
  // Returns safe default or throws
}
```

Errors are logged but don't stop cron execution (PARTIAL status).

---

## Dependencies

Services depend on:
- `@/lib/prisma` - Database access
- `@/lib/logger` - Logging
- `@/lib/analytics/sms-ab-test-statistics` - Statistical analysis

No external dependencies (pure TypeScript + Prisma).

---

## See Also

- `docs/AB_TEST_AUTOMATION_GUIDE.md` - Complete user guide
- `docs/AB_TEST_IMPLEMENTATION_SUMMARY.md` - Technical overview
- `/api/cron/ab-test-daily-aggregate` - Daily cron endpoint
- `/api/admin/ab-tests/cron-history` - Monitoring endpoint
