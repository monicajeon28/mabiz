# AI Segmentation - Quick Start Guide

**Time Required**: 10 minutes  
**Difficulty**: Beginner  
**Last Updated**: 2026-05-27

---

## 5-Minute Quick Start

### 1. Deploy Database Schema

```bash
# Run migration
npx prisma migrate deploy

# Or manually execute SQL:
psql $DATABASE_URL < prisma/segmentation_models.sql
```

### 2. Run Initial Segmentation

```typescript
// In your backend service or cron job
import { runSegmentation } from '@/lib/ai/segmentation-engine';

const result = await runSegmentation('org_123', 5);
console.log(`Created ${result.segments.length} segments for ${result.totalContacts} contacts`);
```

### 3. View Dashboard

Visit: `/analytics/segments`

You should see:
- 5 segment cards with key metrics
- Segment distribution pie chart
- Churn risk bar chart
- Detailed comparison table

---

## Step-by-Step Setup

### Step 1: Database Migration

```bash
# Create migration file
npx prisma migrate dev --name add_segmentation_models

# Generates migration from schema changes
# Then apply to database
```

**Verify Migration**:
```sql
SELECT * FROM "CustomerSegment" LIMIT 1;
SELECT COUNT(*) FROM "ContactSegmentAssignment";
```

### Step 2: Configure Organization

Add to your org setup:
```typescript
const org = await prisma.organization.update({
  where: { id: 'org_123' },
  data: {
    // Segmentation settings
  }
});
```

### Step 3: Run Segmentation

```typescript
// Option A: One-time segmentation
import { runSegmentation } from '@/lib/ai/segmentation-engine';

const result = await runSegmentation('org_123', 5);
```

```typescript
// Option B: Scheduled monthly re-clustering
import { CronJob } from 'cron';

const monthlyReclustering = new CronJob('0 2 1 * *', async () => {
  await runSegmentation('org_123', 5);
  console.log('Monthly re-clustering completed');
});

monthlyReclustering.start();
```

### Step 4: View Results

```bash
# API: Get all segments
curl -H "x-organization-id: org_123" \
  https://your-api.com/api/segments

# API: Get segment details
curl -H "x-organization-id: org_123" \
  https://your-api.com/api/segments/seg_1

# API: Get campaign recommendation
curl -H "x-organization-id: org_123" \
  https://your-api.com/api/segments/seg_1/recommendation
```

### Step 5: Deploy Campaign

Get recommendation for a segment:

```typescript
import { recommendCampaignBySegment } from '@/lib/services/segment-campaigns';

const recommendation = await recommendCampaignBySegment('seg_1', 'org_123');

console.log(`
Segment: ${recommendation.segmentName}
Channel: ${recommendation.recommendedChannel}
Tone: ${recommendation.day0MessageTemplate.tone}
Expected Conversion: ${recommendation.predictedConversionRate}%
Send Time: Day 0 at ${recommendation.optimalSendTimes[0].hour}:00
`);
```

---

## Common Tasks

### Task 1: View All Segments

```bash
# API
GET /api/segments

# Response includes:
# - 5 segments
# - Each with: name, size, churnRisk, avgLtv, avgEngagement, predictedConversion
```

**Dashboard**: `/analytics/segments`

### Task 2: View Segment Contacts

```bash
# API
GET /api/segments/seg_1/contacts

# Returns:
# - 100 contacts in segment
# - Each with: id, name, phone, email, probability, explanation
```

### Task 3: Get Campaign Recommendation

```bash
# API
GET /api/segments/seg_1/recommendation

# Returns:
# {
#   recommendation: {
#     recommendedChannel: "SMS",
#     day0MessageTemplate: {...},
#     day1MessageTemplate: {...},
#     ...
#     predictedConversionRate: 8.2,
#     estimatedRevenue: 369000
#   },
#   suggestedABTest: {...}
# }
```

### Task 4: Create A/B Test

```typescript
import { createABTestForSegment } from '@/lib/services/segment-campaigns';

const abTest = await createABTestForSegment('seg_1', 'org_123');

// Returns draft test with:
// - variantA: Control (recommended)
// - variantB: Variant (alternative tone/timing)
// - expectedSampleSize: 100-225 contacts
// - estimatedDuration: 14 days
```

### Task 5: Monthly Re-clustering

```typescript
import { triggerReclustering } from '@/lib/ai/segmentation-engine';

const result = await triggerReclustering('org_123');

console.log(`
Re-clustering completed:
- ${result.totalContacts} total contacts
- ${result.segments.length} segments
- Convergence: ${result.convergenceStatus}
`);
```

---

## Example: Deploy Campaign for "Premium VIPs" Segment

### Step 1: Identify Segment

```bash
GET /api/segments
→ Returns: Premium Active VIPs (seg_1, 450 contacts, 12% churn)
```

### Step 2: Get Recommendation

```bash
GET /api/segments/seg_1/recommendation
→ Returns: SMS channel, Premium tone, 8.2% expected conversion
```

### Step 3: Review Message Template

```
Day 0: "💎 {{firstName}}님을 위한 특별한 크루즈 패키지..."
Day 1: "✅ 마비즈와 함께라면 모든 준비가 완벽합니다..."
Day 2: "🌟 한정 오퍼: Caribbean Cruise - 50% 할인..."
Day 3: "👑 최종 선택을 기다리고 있습니다. 3가지 옵션..."
```

### Step 4: Create Campaign

```typescript
import { prisma } from '@/lib/prisma';

const campaign = await prisma.crmMarketingCampaign.create({
  data: {
    organizationId: 'org_123',
    name: 'Premium VIPs - Caribbean Cruise',
    description: 'AI-recommended campaign for Premium Active VIPs segment',
    segmentId: 'seg_1',
    
    // Day 0
    smsTemplate: recommendation.day0MessageTemplate.messageTemplate,
    channel: 'SMS',
    sendSchedule: { day: 0, hour: 8 },
    
    // Day 1-3 would be separate sequences
    status: 'DRAFT',
  }
});
```

### Step 5: Deploy & Monitor

```bash
# Deploy campaign
PATCH /api/campaigns/{{campaignId}}
Body: { "status": "ACTIVE" }

# Monitor results
GET /api/campaigns/{{campaignId}}/metrics
→ Real-time: sent, opened, clicked, converted, churn
```

### Step 6: A/B Test Results

```bash
# After 14 days
GET /api/segments/seg_1/ab-test/results

# If Variant B wins:
PATCH /api/campaigns/{{campaignId}}/tone
Body: { "newTone": "Encouraging" }
```

---

## Testing Checklist

Before deploying segmentation to production:

- [ ] **Database Migration**: Verify all 4 tables created
  ```sql
  SELECT tablename FROM pg_tables WHERE tablename LIKE '%Segment%';
  ```

- [ ] **Feature Extraction**: Verify 13 features extracted
  ```typescript
  const features = await extractContactFeatures(contact);
  console.log(Object.keys(features).length); // Should be 13
  ```

- [ ] **Clustering**: Verify convergence
  ```typescript
  const result = await runSegmentation('org_123', 5);
  expect(result.convergenceStatus).toBe('CONVERGED');
  ```

- [ ] **Segment Profiles**: Verify profiles generated
  ```bash
  GET /api/segments
  # Each segment should have: name, size, profile, churnRisk, etc.
  ```

- [ ] **Campaign Recommendations**: Verify channels assigned
  ```bash
  GET /api/segments/seg_1/recommendation
  # Should return: SMS/Kakao/Email with templates
  ```

- [ ] **Dashboard**: Verify visualization
  ```
  Visit /analytics/segments
  - Should show 5 segment cards
  - Should show pie chart, bar chart, comparison table
  ```

---

## Troubleshooting

### Problem: "No contacts after segmentation"

```typescript
// Check if contacts exist
const count = await prisma.contact.count({
  where: { organizationId: 'org_123', deletedAt: null }
});
console.log(`Found ${count} contacts`);
// If 0: Add test data first
```

### Problem: "Clustering not converging"

```typescript
// Check feature extraction
const contact = await prisma.contact.findFirst();
const features = await extractContactFeatures(contact);
// Verify features are in 0-100 range
console.log(features);
```

### Problem: "API returns 404"

```bash
# Verify organization ID header
curl -H "x-organization-id: org_123" \
  https://your-api.com/api/segments
  
# If still 404, check:
# 1. Organization exists
# 2. Segmentation has run
# 3. Database migration applied
```

---

## Performance Tips

### For Large Organizations (100K+ contacts)

```typescript
// Increase timeout
const result = await runSegmentation('org_123', 5);
// Typical timing: 100K contacts = 30-45 seconds

// Monitor progress
console.time('segmentation');
const result = await runSegmentation('org_123', 5);
console.timeEnd('segmentation');
```

### Optimize Re-clustering

```typescript
// Schedule during off-peak hours
const monthlyReclustering = new CronJob(
  '0 2 1 * *', // 2 AM on 1st of month
  async () => {
    await runSegmentation('org_123', 5);
  }
);
```

### Cache Segment Profiles

```typescript
// Cache for 1 hour
const cacheKey = `segments:${orgId}`;
const cached = await redis.get(cacheKey);

if (!cached) {
  const segments = await prisma.customerSegment.findMany({...});
  await redis.setex(cacheKey, 3600, JSON.stringify(segments));
}
```

---

## Next Steps

1. **Advanced**: Read `docs/AI_SEGMENTATION_SPEC.md` for full technical details
2. **Integration**: Hook segmentation to your marketing automation
3. **Optimization**: Run A/B tests to validate recommendations
4. **Scaling**: Set up monthly re-clustering cron jobs

---

## API Reference Cheat Sheet

```bash
# List segments
GET /api/segments
Header: x-organization-id: org_123

# Get segment details
GET /api/segments/{id}
Header: x-organization-id: org_123

# Get contacts in segment
GET /api/segments/{id}/contacts
Header: x-organization-id: org_123

# Get campaign recommendation
GET /api/segments/{id}/recommendation
Header: x-organization-id: org_123

# Create initial segmentation
POST /api/segments
Header: x-organization-id: org_123
Body: { "action": "create-initial" }

# Re-cluster contacts
POST /api/segments
Header: x-organization-id: org_123
Body: { "action": "refresh" }
```

---

## Support

- **Documentation**: `/docs/AI_SEGMENTATION_SPEC.md`
- **Code**: `/src/lib/ai/segmentation-engine.ts`
- **Dashboard**: `/analytics/segments`
- **API**: `/api/segments/*`

---

**Last Updated**: 2026-05-27  
**Version**: 1.0
