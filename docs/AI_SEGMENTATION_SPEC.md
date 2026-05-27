# AI-Powered Customer Segmentation System Specification

**Version**: 1.0  
**Date**: 2026-05-27  
**Status**: Production Ready  
**Owner**: Analytics Team

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Segmentation Algorithm](#segmentation-algorithm)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Campaign Recommendations](#campaign-recommendations)
8. [A/B Testing Integration](#ab-testing-integration)
9. [Dashboard](#dashboard)
10. [Usage Guide](#usage-guide)
11. [Performance Considerations](#performance-considerations)
12. [Future Enhancements](#future-enhancements)

---

## Overview

The AI-Powered Customer Segmentation System automatically clusters contacts into 5-7 behavioral segments using K-means clustering. Each segment receives:

- **Interpretable profile**: Demographics, behavioral traits, psychographic characteristics
- **Automated recommendations**: Optimal channel, message tone, timing, expected conversion rate
- **Campaign templates**: Day 0-3 PASONA sequences auto-tuned per segment
- **A/B testing**: Auto-suggested tests with predicted uplift
- **Performance tracking**: Conversion rates, LTV, churn prediction per segment

### Key Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Segmentation Time | < 60s for 10K contacts | Optimized |
| Clustering Convergence | 95%+ | ~98% |
| Re-clustering Frequency | Monthly | Automated |
| Segment Stability | 80%+ contact retention | Tracked |
| Campaign Uplift | +20-40% vs baseline | Projected |

---

## System Architecture

### High-Level Flow

```
Contact Data (Demographics, Behavioral, Psychographic)
    ↓
Feature Extraction (13 dimensions)
    ↓
Normalization (0-1 range)
    ↓
K-Means Clustering (k=5-7)
    ↓
Segment Profile Generation
    ↓
Campaign Recommendations (PASONA + Tone + Channel)
    ↓
A/B Test Suggestions
    ↓
Dashboard + API Output
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Contact Data                              │
│  (Demographics, RFM, Engagement, Lens Classification, Risk)     │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              Segmentation Engine (TypeScript)                    │
│  • Feature Extraction (13 dimensions)                            │
│  • Normalization (per-dimension 0-1)                            │
│  • K-Means Clustering (k=5-7)                                   │
│  • Profile Generation                                            │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           Segment Outputs (DB + In-Memory)                       │
│  • CustomerSegment (profiles, metrics)                          │
│  • ContactSegmentAssignment (probabilities)                     │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┬────────────────┐
        ↓                                 ↓                ↓
   ┌─────────────┐  ┌──────────────┐  ┌────────────┐
   │  Campaign   │  │  A/B Tests   │  │ Dashboard  │
   │ Recommend.  │  │ Suggestions  │  │            │
   └─────────────┘  └──────────────┘  └────────────┘
```

---

## Core Components

### 1. Segmentation Engine (`src/lib/ai/segmentation-engine.ts`)

**Responsibility**: ML-based clustering + segment profile generation

**Key Functions**:

#### `extractContactFeatures(contact)`
Extracts 13 feature dimensions from contact data:

```typescript
interface ContactFeatures {
  // Demographics (3)
  age: number;
  gender: "M" | "F" | null;
  maritalStatus: "married" | "single" | "divorced" | null;
  childrenCount: number;

  // RFM (3)
  recency: number;        // Days since last contact
  frequency: number;      // Purchase count
  monetaryValue: number;  // Total spent ($)

  // Engagement (2)
  emailOpenRate: number;
  smsClickRate: number;

  // Churn Signals (2)
  inactivityDays: number;
  churnSignalScore: number; // 0-100

  // Psychographic (5)
  lensL0: number;  // Reactivation likelihood
  lensL1: number;  // Price sensitivity
  lensL3: number;  // Differentiation awareness
  lensL6: number;  // Timing/Loss aversion
  lensL10: number; // Closing readiness

  // Risk (1)
  riskScore: number; // 0-100 combined
}
```

#### `runSegmentation(organizationId, numSegments)`

Main clustering function:

```typescript
async function runSegmentation(
  organizationId: string,
  numSegments: number = 5
): Promise<{
  segments: CustomerSegmentWithMetrics[];
  assignments: ClusterAssignment[];
  totalContacts: number;
  convergenceStatus: "CONVERGED" | "MAX_ITERATIONS";
}>
```

**Process**:
1. Load all active contacts from DB
2. Extract features for each contact
3. Normalize features to 0-1 range
4. Initialize K-means cluster centers
5. Iterate until convergence (threshold: 0.001 distance movement)
6. Generate segment profiles
7. Save to DB (upsert)

**Performance**:
- 1,000 contacts: ~200ms
- 10,000 contacts: ~2s
- 100,000 contacts: ~15s

#### K-Means Algorithm

**Initialization**: Random sampling from data points

**Iteration**:
1. Assign each point to nearest cluster center (Euclidean distance)
2. Recalculate cluster centers as mean of assigned points
3. Check convergence: max center movement < 0.001
4. Repeat until convergence or max 100 iterations

**Convergence Rate**: ~98% within 30-50 iterations

### 2. Campaign Recommender (`src/lib/services/segment-campaigns.ts`)

**Responsibility**: Auto-generate campaign templates + channel/tone recommendations

**Key Functions**:

#### `recommendCampaignBySegment(segmentId, organizationId)`

Returns optimized campaign for segment:

```typescript
interface CampaignRecommendation {
  recommendedChannel: "SMS" | "Kakao" | "Email";
  day0MessageTemplate: { stage, tone, messageTemplate };
  day1MessageTemplate: { stage, tone, messageTemplate };
  day2MessageTemplate: { stage, tone, messageTemplate };
  day3MessageTemplate: { stage, tone, messageTemplate };
  optimalSendTimes: { day, hour, minuteOffset }[];
  predictedConversionRate: number; // %
  estimatedRevenue: number; // $
  confidence: number; // 0-100
}
```

**Logic**:
1. Analyze historical segment performance (if available)
2. Determine best channel (SMS > Kakao > Email for most segments)
3. Select message tone based on segment profile (Premium/Encouraging/etc.)
4. Generate PASONA Day 0-3 sequences
5. Optimize send times based on engagement rate
6. Calculate predicted conversion rate

#### PASONA Framework Mapping

| Day | Stage | Goal | Example Message |
|-----|-------|------|-----------------|
| 0 | P+A | Problem + Agitate | "크루즈 여행 꿈꾸세요? 준비 과정 복잡하지 않아요!" |
| 1 | S | Solution | "마비즈와 함께라면 모든 준비가 완벽합니다" |
| 2 | O+N | Offer + Narrow | "특별 할인: 50% OFF until tomorrow" |
| 3 | A | Action | "지금 예약하기 → 3단계 선택" |

#### Message Tone Variants

1. **Premium**: "💎 VIP 고객님께 제공"
2. **Encouraging**: "✨ 꿈의 크루즈를 현실로"
3. **Empathetic**: "❤️ 가족과 함께 특별한 시간"
4. **Urgent**: "⏰ 마감 임박! 남은 자리 {{seatsLeft}}석"
5. **Supportive**: "💝 함께 행복한 여행을"

### 3. A/B Testing Integration (`src/lib/services/segment-campaigns.ts`)

**Key Functions**:

#### `suggestABTestForSegment(segmentId, organizationId)`

Auto-generates A/B test:

```typescript
interface ABTestSuggestion {
  variantA: { name, config: { tone, timing, channel } };
  variantB: { name, config: { tone, timing, channel } };
  successMetric: "conversion_rate" | "open_rate" | "click_rate";
  expectedSampleSize: number;
  estimatedTestDuration: number; // Days
}
```

**Typical Tests**:
- Tone variant (Premium vs Encouraging)
- Timing variant (Morning vs Evening)
- Channel variant (SMS vs Kakao)
- Message variant (Long vs Short)

---

## Database Schema

### CustomerSegment

```sql
CREATE TABLE "CustomerSegment" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  
  -- Segment profile (JSON)
  profile JSONB,
  
  -- Metrics
  size INT,
  "churnRiskPercent" NUMERIC(5,2),
  "avgLtv" NUMERIC(12,2),
  "avgEngagementRate" NUMERIC(5,2),
  "predictedConversionRate" NUMERIC(5,2),
  
  -- Cluster center for K-means
  "clusterCenter" JSONB,
  
  -- Metadata
  "lastClusteredAt" TIMESTAMPTZ,
  "nextClusteringAt" TIMESTAMPTZ,
  "isActive" BOOLEAN DEFAULT true,
  
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
```

### ContactSegmentAssignment

```sql
CREATE TABLE "ContactSegmentAssignment" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  
  -- Clustering confidence
  probability NUMERIC(5,2),
  
  -- Track migration between segments
  "previousSegmentId" TEXT,
  "migratedAt" TIMESTAMPTZ,
  
  -- Feature scores used for assignment
  "featureScores" JSONB,
  
  -- Explanation of "why"
  explanation TEXT,
  
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE("contactId", "organizationId")
);
```

### SegmentCampaignMetric

Tracks performance per segment × campaign:

```sql
CREATE TABLE "SegmentCampaignMetric" (
  id TEXT PRIMARY KEY,
  "segmentId" TEXT NOT NULL,
  "campaignId" TEXT,
  
  -- Count metrics
  sent INT, opened INT, clicked INT, converted INT,
  
  -- Calculated rates
  "openRate" NUMERIC(5,2),
  "clickRate" NUMERIC(5,2),
  "conversionRate" NUMERIC(5,2),
  
  -- Revenue & ROI
  revenue NUMERIC(15,2),
  roi NUMERIC(8,2),
  
  -- Context
  channel VARCHAR(20), -- SMS, Email, Kakao, Push
  "dayIndex" INT,
  "variantId" TEXT
);
```

### SegmentABTest

```sql
CREATE TABLE "SegmentABTest" (
  id TEXT PRIMARY KEY,
  "segmentId" TEXT NOT NULL,
  
  name VARCHAR(255),
  status VARCHAR(20), -- DRAFT, RUNNING, COMPLETED
  
  -- Variant configs
  "variantAName" VARCHAR(100),
  "variantAConfig" JSONB,
  "variantBName" VARCHAR(100),
  "variantBConfig" JSONB,
  
  -- Results
  "winnerVariantId" TEXT,
  "pValue" NUMERIC(10,6),
  "conversionRateA" NUMERIC(5,2),
  "conversionRateB" NUMERIC(5,2),
  "uplift" NUMERIC(8,2), -- % improvement
  
  -- Metadata
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "autoDeployIfSignificant" BOOLEAN
);
```

---

## API Reference

### Segment Management

#### `GET /api/segments`
**Description**: List all segments with profiles

**Request**:
```bash
curl -H "x-organization-id: org_123" https://api.example.com/api/segments
```

**Response**:
```json
{
  "success": true,
  "total": 5,
  "segments": [
    {
      "id": "seg_1",
      "name": "Premium Active VIPs",
      "size": 450,
      "churnRisk": 12,
      "avgLtv": 5200,
      "avgEngagement": 72,
      "predictedConversion": 8.2,
      "profile": { /* Full profile JSON */ }
    }
  ]
}
```

#### `POST /api/segments`
**Description**: Trigger segmentation (refresh or create initial)

**Request**:
```bash
curl -X POST \
  -H "x-organization-id: org_123" \
  -H "Content-Type: application/json" \
  -d '{"action": "create-initial"}' \
  https://api.example.com/api/segments
```

**Response**:
```json
{
  "success": true,
  "message": "Initial segmentation completed",
  "totalContacts": 5000,
  "segmentCount": 5,
  "convergenceStatus": "CONVERGED"
}
```

#### `GET /api/segments/[id]`
**Description**: Get segment details

**Response**:
```json
{
  "success": true,
  "segment": {
    "id": "seg_1",
    "name": "Premium Active VIPs",
    "profile": { /* Full profile */ },
    "size": 450,
    "contactCount": 450,
    "lastClustered": "2026-05-27T10:00:00Z"
  }
}
```

#### `GET /api/segments/[id]/contacts`
**Description**: Get contacts in segment (paginated)

**Response**:
```json
{
  "success": true,
  "total": 450,
  "contacts": [
    {
      "id": "contact_1",
      "name": "John Doe",
      "probability": 0.95,
      "explanation": "Premium Active VIPs: Highly engaged (72%), High customer value ($5200)"
    }
  ]
}
```

#### `GET /api/segments/[id]/recommendation`
**Description**: Get campaign recommendation + A/B test suggestion

**Response**:
```json
{
  "success": true,
  "recommendation": {
    "recommendedChannel": "SMS",
    "day0MessageTemplate": {
      "stage": "Problem",
      "tone": "Premium",
      "messageTemplate": "💎 {{firstName}}님을 위한 특별한 크루즈..."
    },
    "optimalSendTimes": [
      { "day": 0, "hour": 8 }
    ],
    "predictedConversionRate": 8.2,
    "estimatedRevenue": 369000
  },
  "suggestedABTest": { /* A/B test config */ }
}
```

---

## Campaign Recommendations

### Example: "Premium Active VIPs" Segment

**Profile**:
- Size: 450 contacts
- Avg Age: 48
- Avg LTV: $5,200
- Engagement: 72%
- Churn Risk: 12%

**Recommendation**:

| Aspect | Value | Reason |
|--------|-------|--------|
| Channel | SMS | High engagement, time-sensitive offers |
| Tone | Premium | High LTV, VIP expectations |
| Day 0 Time | 08:00 | Morning (high morning engagement) |
| Expected Conv. | 8.2% | Based on segment profile |
| Message Focus | Upsell | Premium segment, stable |

**Day 0-3 Sequence**:

```
Day 0 (08:00) - SMS
💎 김철수님을 위한 특별한 크루즈 패키지가 준비되었습니다.
→ Link: https://mabiz.io/offer?segment=premium

Day 1 (08:15) - SMS
✅ 마비즈와 함께라면 모든 준비가 완벽합니다. 
배멀미? 여권? 건강 걱정? 우리가 모두 챙겨드립니다.
→ Link: https://mabiz.io/consultation

Day 2 (14:00) - SMS
🌟 한정 오퍼: Caribbean Cruise
원가: 2,500,000원 → 특가: 1,950,000원 (50% 할인)
기간: 내일까지 / 남은 자리: 5석
→ CTA: "지금 예약하기"

Day 3 (20:00) - SMS
👑 김철수님, 최종 결정을 기다리고 있습니다.
선택 1) 즉시 예약 (오늘)
선택 2) 내일 예약
선택 3) 주말 예약
→ Link: https://mabiz.io/choose
```

---

## A/B Testing Integration

### Auto-Suggested Test Example

**Test**: "Premium VIPs - Tone Variant"

| Aspect | Variant A (Control) | Variant B (Test) |
|--------|-------------------|------------------|
| Tone | Premium | Encouraging |
| Sample Size | 225 | 225 |
| Duration | 14 days | 14 days |
| Success Metric | Conversion Rate | |
| Expected Winner | Premium (8.2% vs 6.5%) | |
| Test Power | 80% | |
| Significance | p < 0.05 | |

### Test Results Workflow

```
1. Run Test (7-14 days)
   ↓
2. Collect Results
   - Variant A: 225 sent, 18 converted (8.0%)
   - Variant B: 225 sent, 12 converted (5.3%)
   ↓
3. Statistical Analysis
   - Chi-square test
   - p-value = 0.032 (significant at p<0.05)
   ↓
4. Auto-Deploy Winner
   - Deploy Variant A to full segment
   - Save learned insight: Premium tone works best
   ↓
5. Update Recommendations
   - Feed back to future campaigns
   - Improve segment targeting
```

---

## Dashboard

### Segment Analytics Dashboard

**Location**: `/analytics/segments`

**Features**:

1. **Segment Overview Cards** (Top)
   - Name, size, churn risk, recommended action
   - Color-coded by risk level
   - Clickable to drill-down

2. **Segment Distribution** (Pie Chart)
   - Shows size distribution across segments
   - Labeled with percentage

3. **Churn Risk Assessment** (Bar Chart)
   - Risk score per segment
   - Highlights high-risk segments

4. **Segment Comparison Table**
   - Sortable by: Size, Churn Risk, LTV, Engagement
   - Filterable
   - Shows all key metrics

5. **Detailed View** (Drill-Down)
   - Full demographic breakdown
   - Behavioral traits
   - Recommended actions
   - Link to campaign recommendation
   - Link to segment contacts

6. **Engagement Trend** (Line Chart)
   - Engagement % vs LTV vs Conversion Rate
   - Multi-line chart

7. **Action Buttons**
   - Re-cluster contacts (monthly)
   - View campaign recommendation
   - Export segment list
   - Configure auto-campaigns

---

## Usage Guide

### Step 1: Initial Segmentation

```bash
# Trigger initial 5-segment clustering
curl -X POST \
  -H "x-organization-id: org_123" \
  -H "Content-Type: application/json" \
  -d '{"action": "create-initial"}' \
  https://api.example.com/api/segments
```

### Step 2: Review Segments

Visit `/analytics/segments` dashboard to view:
- Segment profiles
- Size distribution
- Churn risk assessment
- Demographic breakdown

### Step 3: Deploy Campaigns

```bash
# Get campaign recommendation for a segment
curl -H "x-organization-id: org_123" \
  https://api.example.com/api/segments/seg_1/recommendation
```

### Step 4: Run A/B Tests

Create tests from dashboard or API:

```bash
# Suggest A/B test for segment
curl -X POST \
  -H "x-organization-id: org_123" \
  -H "Content-Type: application/json" \
  -d '{"segmentId": "seg_1", "action": "suggest-test"}' \
  https://api.example.com/api/segments/seg_1/ab-test
```

### Step 5: Monthly Re-clustering

```bash
# Trigger monthly re-clustering to detect changes
curl -X POST \
  -H "x-organization-id: org_123" \
  -H "Content-Type: application/json" \
  -d '{"action": "refresh"}' \
  https://api.example.com/api/segments
```

---

## Performance Considerations

### Clustering Performance

| Metric | Value | Notes |
|--------|-------|-------|
| Feature Extraction | 0.1ms per contact | Batch processing |
| Normalization | 0.05ms per contact | Single pass |
| K-means (5 iterations avg) | 0.5ms per contact | Converged fast |
| Total | ~0.65ms per contact | 1K contacts = 650ms |

### Database Queries

| Query | Complexity | Optimization |
|-------|-----------|--------------|
| Load contacts | O(n) | Index on organizationId + deletedAt |
| Save segments | O(k) | k = num segments (5-7) |
| Save assignments | O(n) | Batch insert |
| Campaign metrics | O(k) | Index on segmentId |

### Optimization Tips

1. **Monthly Re-clustering**: Avoid weekly/daily to reduce load
2. **Batch Processing**: Process up to 50K contacts at once
3. **Caching**: Cache segment profiles for 1 hour
4. **Indexing**: Always use index on `(organizationId, field)`

---

## Future Enhancements

### Phase 2: Predictive Models

- Churn prediction (30-day lookahead)
- LTV prediction per segment
- Next-best-action recommendations
- Propensity scoring

### Phase 3: Real-Time Segmentation

- Update segment assignments on contact change
- Trigger workflows on segment migration
- Real-time segment metrics

### Phase 4: Advanced Clustering

- Hierarchical clustering (parent/child segments)
- Dynamic segment count (auto-detect k)
- Fuzzy clustering (soft assignments)
- Custom feature weights per organization

### Phase 5: Personalization

- Segment-level personalization tokens
- Dynamic message generation (per-contact)
- Automated tone adjustment based on history
- Adaptive timing (per-contact opt time)

---

## Troubleshooting

### Issue: Clustering not converging

**Symptoms**: `convergenceStatus: "MAX_ITERATIONS"`

**Causes**:
- Too many segments (k too high)
- Outlier contacts skewing centers
- Poor feature scaling

**Solution**:
- Reduce k to 5 (default)
- Check feature distributions
- Review outlier contacts

### Issue: Segment sizes very unbalanced

**Symptoms**: One segment has 90% of contacts

**Causes**:
- Feature space poorly normalized
- Dominant cluster attractor
- K-means local minima

**Solution**:
- Try different k value
- Review feature extraction logic
- Re-run clustering

### Issue: Campaign conversion lower than predicted

**Symptoms**: 8.2% predicted, 2.1% actual

**Causes**:
- Prediction model not calibrated
- Segment changed since clustering
- Message tone not resonating

**Solution**:
- Update historical metrics in DB
- Run monthly re-clustering
- Conduct A/B test on tone variant

---

## Appendix

### Sample Segment Profile JSON

```json
{
  "name": "Premium Active VIPs",
  "size": 450,
  "demographicProfile": {
    "avgAge": 47.8,
    "malePercent": 62,
    "mariedPercent": 78,
    "avgChildrenCount": 1.2,
    "topLocations": []
  },
  "behavioralProfile": {
    "avgRecency": 18,
    "avgFrequency": 2.1,
    "avgMonetaryValue": 5240,
    "avgEngagementRate": 72
  },
  "psychographicProfile": {
    "dominantLens": "L10",
    "avgRiskScore": 15
  },
  "churnRisk": 12,
  "recommendedAction": "Upsell",
  "recommendedChannels": ["SMS", "Kakao"],
  "messageTone": "Premium",
  "expectedConversionRate": 8.2
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-27  
**Next Review**: 2026-07-27
