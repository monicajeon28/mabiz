# AI Segmentation System - File Reference

**Quick Navigation for Developers**

---

## Core Implementation Files

### 1. Segmentation Engine
**File**: `src/lib/ai/segmentation-engine.ts` (412 lines)

**Key Functions**:
```typescript
export async function runSegmentation(orgId, numSegments)
export async function extractContactFeatures(contact)
export async function getSegmentDetails(segmentId)
export async function triggerReclustering(orgId)
```

**Used by**: Campaign recommender, API endpoints, cron jobs

---

### 2. Campaign Recommender
**File**: `src/lib/services/segment-campaigns.ts` (250 lines)

**Key Functions**:
```typescript
export async function recommendCampaignBySegment(segmentId, orgId)
export async function suggestABTestForSegment(segmentId, orgId)
export async function createABTestForSegment(segmentId, orgId)
```

**Used by**: Dashboard, API endpoints

---

### 3. API Routes

#### List/Refresh Segments
**File**: `src/app/api/segments/route.ts` (70 lines)
```
GET  /api/segments              → List all segments
POST /api/segments              → Create initial or refresh
```

#### Get Details
**File**: `src/app/api/segments/[id]/route.ts` (80 lines)
```
GET  /api/segments/[id]                 → Segment details
GET  /api/segments/[id]/contacts       → Contacts in segment
GET  /api/segments/[id]/recommendation → Campaign recommendation
```

---

### 4. Dashboard
**File**: `src/app/(dashboard)/analytics/segments/page.tsx` (368 lines)

**Features**:
- Segment overview cards
- 4 interactive charts (pie, bar, line, heatmap)
- Detailed comparison table
- Drill-down views
- Action buttons

**Accessed via**: `/analytics/segments`

---

## Database Files

### Schema
**File**: `prisma/schema.prisma`

Added tables:
- CustomerSegment
- ContactSegmentAssignment
- SegmentCampaignMetric
- SegmentABTest

### Migration SQL
**File**: `prisma/segmentation_models.sql` (250 lines)

Contains:
- Table definitions (4 tables)
- Indexes (16 total)
- Foreign keys (4)

**Deploy with**: `npx prisma migrate deploy`

---

## Documentation Files

### Full Specification
**File**: `docs/AI_SEGMENTATION_SPEC.md` (600 lines)

Covers:
- System architecture
- Algorithm details
- Database schema
- API reference
- Campaign recommendations
- A/B testing
- Performance considerations
- Troubleshooting

### Quick Start Guide
**File**: `docs/QUICKSTART_SEGMENTATION.md` (300 lines)

Covers:
- 5-minute setup
- Step-by-step guide
- Common tasks
- Testing checklist
- Troubleshooting
- API cheat sheet

### Implementation Summary
**File**: `docs/SEGMENTATION_IMPLEMENTATION_SUMMARY.md` (200 lines)

Covers:
- Project overview
- Deliverables checklist
- Technical specs
- Integration points
- Usage examples
- Known limitations
- Deployment checklist

---

## Testing Files

### Unit Tests
**File**: `src/lib/ai/__tests__/segmentation-engine.test.ts` (200 lines)

Test coverage:
- Feature extraction (13 dimensions)
- Normalization
- K-means convergence
- Segment profile generation
- Edge cases
- Explanations

**Run with**: `npm test -- segmentation-engine`

---

## How to Use (By Role)

### For Product Managers

1. **View Metrics**: `/analytics/segments`
2. **Read Overview**: `docs/SEGMENTATION_IMPLEMENTATION_SUMMARY.md`
3. **Understand KPIs**: `docs/AI_SEGMENTATION_SPEC.md` → Performance section

---

### For Backend Engineers

1. **Setup**: `docs/QUICKSTART_SEGMENTATION.md` → Step-by-step
2. **Integration**: Review `src/lib/ai/segmentation-engine.ts`
3. **Database**: Review `prisma/segmentation_models.sql`
4. **API**: Check `src/app/api/segments/*`
5. **Tests**: `src/lib/ai/__tests__/segmentation-engine.test.ts`

---

### For Frontend Engineers

1. **Dashboard**: `src/app/(dashboard)/analytics/segments/page.tsx`
2. **API Endpoints**: `src/app/api/segments/*`
3. **Data Structure**: `docs/AI_SEGMENTATION_SPEC.md` → API Reference

---

### For Data Scientists

1. **Algorithm**: `src/lib/ai/segmentation-engine.ts`
2. **Features**: Lines 50-100 (ContactFeatures interface)
3. **K-Means**: Lines 130-250 (KMeansClustering class)
4. **Normalization**: Lines 310-330
5. **Spec**: `docs/AI_SEGMENTATION_SPEC.md` → Segmentation Algorithm

---

## Quick Reference

### Most Common Tasks

#### 1. Trigger Initial Segmentation
```bash
curl -X POST \
  -H "x-organization-id: org_123" \
  -H "Content-Type: application/json" \
  -d '{"action": "create-initial"}' \
  https://api.example.com/api/segments
```

#### 2. Get Segment Details
```bash
curl -H "x-organization-id: org_123" \
  https://api.example.com/api/segments/seg_1
```

#### 3. Get Campaign Recommendation
```bash
curl -H "x-organization-id: org_123" \
  https://api.example.com/api/segments/seg_1/recommendation
```

#### 4. View Dashboard
Visit: `/analytics/segments`

#### 5. Monthly Re-clustering
```bash
curl -X POST \
  -H "x-organization-id: org_123" \
  -H "Content-Type: application/json" \
  -d '{"action": "refresh"}' \
  https://api.example.com/api/segments
```

---

## Integration Checklist

- [ ] Database migration applied (`npx prisma migrate deploy`)
- [ ] Segmentation engine tested locally
- [ ] API endpoints verified
- [ ] Dashboard loads at `/analytics/segments`
- [ ] Cron job setup for monthly re-clustering
- [ ] A/B testing configured
- [ ] Campaign templates created
- [ ] Team trained on dashboard

---

## Performance Tips

### For Large Orgs (100K+ contacts)
1. Schedule segmentation during off-peak (2 AM)
2. Use batching for contact assignment
3. Cache segment profiles (1 hour TTL)
4. Monitor query performance

### Optimization
```typescript
// Cache segment profiles
const cacheKey = `segments:${orgId}`;
const cached = await redis.get(cacheKey);
if (!cached) {
  const segments = await getSegments();
  await redis.setex(cacheKey, 3600, JSON.stringify(segments));
}
```

---

## Support

- **Issues**: See `docs/AI_SEGMENTATION_SPEC.md` → Troubleshooting
- **Questions**: Check `docs/QUICKSTART_SEGMENTATION.md` → FAQ
- **Technical Details**: Review `docs/AI_SEGMENTATION_SPEC.md`

---

**Last Updated**: 2026-05-27  
**Status**: Production Ready  
**Version**: 1.0
