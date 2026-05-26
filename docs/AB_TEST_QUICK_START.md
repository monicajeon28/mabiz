# A/B Test Dashboard - Quick Start (5 Min)

## Installation

### 1. Database Migration
```bash
# Apply Prisma migrations (if not already done)
npx prisma migrate deploy

# Verify tables exist
npx prisma db push
```

### 2. No additional npm packages needed!
All dependencies already in project:
- `next` ✓
- `prisma` ✓
- TypeScript ✓

---

## Usage

### Create A/B Test

```bash
curl -X POST http://localhost:3000/api/sms-ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Day 0 SMS Urgency Test",
    "objectiveType": "CLICK_RATE",
    "variantATemplate": "가격 마감까지 2시간만 남았습니다. 지금 예약하세요!",
    "variantBTemplate": "⏰ 긴급: 단 2시간! 인기 상품 마감 임박. 지금 확인하세요!",
    "psychologyLens": "L6_TIMING",
    "copyAngle": "LOSS_AVERSION"
  }'
```

Response:
```json
{
  "data": {
    "id": "test_abc123",
    "name": "Day 0 SMS Urgency Test",
    "status": "ACTIVE",
    "createdAt": "2026-05-27T14:00:00Z"
  }
}
```

### Send SMS with A/B Test Tracking

```typescript
// In your SMS sending logic
const testId = "test_abc123"
const abTestGroup = Math.random() > 0.5 ? "A" : "B" // 50/50 split

const template = abTestGroup === "A" 
  ? "가격 마감까지 2시간만 남았습니다..."
  : "⏰ 긴급: 단 2시간! 인기 상품..."

await sendSMS({
  phone: contact.phone,
  message: template,
  organizationId: org.id,
  // Tracking
  abTestId: testId,
  abTestGroup: abTestGroup,
  psychologyLens: "L6_TIMING",
  segmentCode: "L6_URGENT"
})

// Log to database
await prisma.smsLog.create({
  data: {
    organizationId: org.id,
    phone: contact.phone,
    contentPreview: template,
    status: "SENT",
    sentAt: new Date(),
    abTestId: testId,
    abTestGroup: abTestGroup,
    psychologyLens: "L6_TIMING",
    segmentCode: "L6_URGENT",
    channel: "FUNNEL"
  }
})
```

### Track Conversions

```typescript
// When customer converts (purchases, clicks, etc.)
await prisma.smsLog.update({
  where: { id: logId },
  data: {
    convertedAt: new Date(), // Marks as converted
    // Optional: track click
    clickedAt: new Date()
  }
})
```

### View Dashboard

1. Open: `http://localhost:3000/dashboard/sms-logs`
2. Click tab: **"A/B 테스트 분석"**
3. Select test from dropdown
4. See real-time metrics

---

## API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sms-ab-tests` | GET | List all tests |
| `/api/sms-ab-tests` | POST | Create test |
| `/api/sms-ab-tests/{id}` | GET | Get test details + stats |
| `/api/sms-ab-tests/{id}/timeline` | GET | Get daily breakdown |

### Example Responses

**GET /api/sms-ab-tests/test_abc123**
```json
{
  "data": {
    "id": "test_abc123",
    "name": "Day 0 SMS Urgency Test",
    "status": "ACTIVE",
    "currentMetrics": {
      "groupA": {
        "sent": 5000,
        "opened": 1500,
        "clicked": 450,
        "converted": 90,
        "conversionRate": 0.018
      },
      "groupB": {
        "sent": 4800,
        "opened": 1920,
        "clicked": 672,
        "converted": 134,
        "conversionRate": 0.0279
      }
    },
    "statistics": {
      "pValue": 0.0145,
      "zScore": 2.44,
      "relativeRisk": 1.55,
      "isStatisticallySignificant": true,
      "confidenceIntervals": {
        "A": { "lower": 0.012, "upper": 0.026 },
        "B": { "lower": 0.020, "upper": 0.037 },
        "difference": { "lower": 0.003, "upper": 0.021 }
      }
    },
    "recommendation": "✅ B is 55% better (p=0.0145, RR=1.55x). Deploy B."
  }
}
```

---

## Dashboard Features

### 1. Test Selector
- Dropdown to pick which test to analyze
- Auto-filters by date range (1/3/7/14/30 days)

### 2. Comparison Table
```
지표        A (기존)   B (신규)   차이      비율
발송수      5,000     4,800     -200     -4.0%
오픈율      30.0%     40.0%     +10.0%   +33.3%
클릭율      9.0%      14.0%     +5.0%    +55.6%
전환율      1.8%      2.79%     +0.99%   +55.0%
```

### 3. Statistics Panel
- χ²: 5.91 (Chi-square)
- Z: 2.44 (Z-score)
- RR: 1.55x (Relative Risk)
- OR: 1.61 (Odds Ratio)
- p-value: 0.0145 (✓ Significant)
- 95% CI: [0.003, 0.021]

### 4. Recommendation
```
✅ B is 55% better (p=0.0145, RR=1.55x). Deploy B.
```

### 5. Timeline (Last 7 Days)
```
Date       A Rate    B Rate    p-value   Significant
2026-05-21 1.5%     1.8%      0.4521    No
2026-05-22 1.6%     2.1%      0.3201    No
2026-05-23 1.7%     2.3%      0.1542    No
2026-05-24 1.8%     2.6%      0.0456    Yes ✓
2026-05-25 1.9%     2.7%      0.0234    Yes ✓
2026-05-26 1.9%     2.8%      0.0145    Yes ✓
2026-05-27 1.8%     2.79%     0.0145    Yes ✓
```

### 6. Template Comparison
```
A (기존)                    B (신규)
가격 마감까지 2시간만   ⏰ 긴급: 단 2시간!
남았습니다.             인기 상품 마감 임박.
지금 예약하세요!        지금 확인하세요!
```

---

## Common Scenarios

### Scenario 1: Testing SMS Copy
```
Test: "Loss Aversion" (L6 Lens)
A: "가격이 내려갈 수 있습니다" (subtle)
B: "지금 신청하지 않으면 후회할 수 있습니다!" (urgent)

Duration: 7 days
Min sample: 100 per group
Goal: 55%+ conversion lift
```

### Scenario 2: Testing Time of Day
```
Test: "Timing Optimization" (L6 Lens)
A: Send at 9 AM (baseline)
B: Send at 2 PM (afternoon engagement)

Duration: 14 days
Min sample: 500 per group
Goal: Higher click-through rate
```

### Scenario 3: Testing Psycho Angle
```
Test: "Health Safety" (L9 Lens)
A: "재미있는 크루즈" (experience)
B: "배멀미 완벽 대책 + 의료진 상시" (medical assurance)

Duration: 30 days
Min sample: 1000 per group
Goal: Higher conversion for health-conscious segment
```

---

## Troubleshooting

### Q: Dashboard shows "No A/B tests found"
**A:** 
1. Check that tests exist: `GET /api/sms-ab-tests`
2. Verify SMS logs have `abTestId` and `abTestGroup` set
3. Check organization boundary (orgId must match auth)

### Q: Statistics show "NaN" or "Infinity"
**A:**
1. Ensure enough samples per group (min 100 recommended)
2. Check for malformed data in SmsLog table
3. Verify `convertedAt` timestamps are valid

### Q: Timeline is empty
**A:**
1. Ensure cron job running that creates `SmsABTestTimeline` snapshots
2. Or manually create snapshot: `POST /api/cron/daily-snapshot`
3. Check that at least 1 day has passed since test start

### Q: "p-value: 0.9999" (very high)
**A:**
1. Groups are too similar (good news - no major difference!)
2. Continue testing to reach statistical power
3. Consider larger effect size in variant copy

### Q: One group has 10x more sends than other
**A:**
1. Random allocation may drift with small samples
2. Use weighted allocation: `new Map([['A', 0.5], ['B', 0.5]])`
3. Or manually ensure 50/50 split in contact selection

---

## Code Examples

### Generate Random A/B Allocation
```typescript
function getABGroup(): 'A' | 'B' {
  return Math.random() > 0.5 ? 'A' : 'B'
}

// Weighted allocation (60% A, 40% B)
function getABGroupWeighted(): 'A' | 'B' {
  return Math.random() > 0.4 ? 'A' : 'B'
}
```

### Track SMS Opens (from Aligo Webhook)
```typescript
// Webhook from Aligo SMS service
export async function POST(req: NextRequest) {
  const body = await req.json()
  
  // Aligo sends msgId when SMS is opened
  await prisma.smsLog.update({
    where: { msgId: body.msgId },
    data: {
      openedAt: new Date(),
      // Note: convertedAt only set when actual conversion happens
    }
  })
}
```

### Calculate Live Metrics
```typescript
import { analyzeABTest } from '@/lib/analytics/sms-ab-test-statistics'

const logs = await prisma.smsLog.findMany({
  where: { abTestId: testId }
})

const groupA = logs.filter(l => l.abTestGroup === 'A')
const groupB = logs.filter(l => l.abTestGroup === 'B')

const stats = analyzeABTest(
  groupA.filter(l => l.convertedAt).length,
  groupA.length,
  groupB.filter(l => l.convertedAt).length,
  groupB.length
)

console.log(`Winner: ${stats.relativeRisk > 1 ? 'B' : 'A'}`)
console.log(`Improvement: ${((stats.relativeRisk - 1) * 100).toFixed(1)}%`)
console.log(`Confidence: ${stats.isStatisticallySignificant ? 'p < 0.05 ✓' : 'Need more data'}`)
```

---

## Performance Tips

1. **Limit date range**: Always use `?days=7` or `?days=30` (not 90)
2. **Cache timelines**: Daily snapshots should be cached 1 hour
3. **Index SmsLog**: Ensure indexes on (abTestId, sentAt, organizationId)
4. **Batch updates**: Group conversions and mark them together

```typescript
// Bad: Individual updates (1000 queries)
for (const log of logs) {
  await prisma.smsLog.update({ where: { id: log.id }, data: { convertedAt: now } })
}

// Good: Batch update (1 query)
await prisma.smsLog.updateMany({
  where: { id: { in: logs.map(l => l.id) } },
  data: { convertedAt: now }
})
```

---

## Next Steps

1. ✅ Create your first test
2. ✅ Send SMS with `abTestId` and `abTestGroup`
3. ✅ Track conversions with `convertedAt`
4. ✅ View dashboard after 24-48 hours
5. ✅ When p-value < 0.05, deploy winning variant
6. ✅ Archive test and start new one

---

**Ready to A/B test?** Start with any SMS campaign and split audience 50/50 A/B!
