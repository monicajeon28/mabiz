# Partner Success Automation System - Complete Specification

**Version**: 1.0  
**Date**: 2026-05-27  
**Status**: Production Ready  

## Executive Summary

The Partner Success Automation system provides a comprehensive framework for onboarding, tracking, and retaining affiliate and partner program participants. Built on data-driven risk scoring, tier management, and proactive interventions, this system targets:

- **Retention Rate**: 85%+ (vs. industry average 60%)
- **Partner Lifetime Value**: +200% vs. without automation
- **Time to First Sale**: Reduced by 50% through guided onboarding
- **Commission Growth**: 3-4x increase through tier incentives

---

## 1. Core Components

### 1.1 Partner Onboarding Automation

**Purpose**: Guide new partners through first 14 days with structured support  
**Trigger**: Manual start or automatic on partner creation

**Sequence**:

| Day | Channel | Subject | Goal | Type |
|-----|---------|---------|------|------|
| 1 | Email | Welcome to {{org}}, {{name}}! | Activation | Instruction |
| 1 | SMS | Quick start message | Urgency | Notification |
| 3 | Email | 3 Quick Tips to Close Your First Sale | Education | Guidance |
| 7 | Email | One Week In - You're Doing Great! | Celebration | Motivation |
| 14 | Email | 2 Weeks In - Time to Scale Up | Graduation | Next Steps |

**Key Features**:
- Personalized templates with partner data
- Performance metrics included (sales, commission, rank)
- Progressive difficulty (foundation → scaling)
- Clear action items each step
- Graduation to ongoing support after Day 14

**Metrics Tracked**:
- Email open rate
- Click-through rate
- Call-to-action completion
- First sale timing
- Success rate (contacts → sales)

**File Location**: `/src/lib/services/partner-onboarding-service.ts`

---

### 1.2 Partner Analytics Service

**Purpose**: Daily aggregation of partner performance metrics  
**Frequency**: Real-time (via API) + daily batch aggregation (cron)

**Metrics Calculated**:

```typescript
{
  dailyMetrics: {
    partnerId: string;
    date: Date;
    salesCount: number;
    commission: bigint;
    weeklyComparison: {
      salesCount: number;
      commission: bigint;
      percentChange: number; // vs previous week
    };
    monthlyComparison: {
      salesCount: number;
      commission: bigint;
      percentChange: number; // vs previous month
    };
    topCustomers: Array<{
      contactId: string;
      name: string;
      email: string;
      purchasedAt: Date;
    }>;
    churnRate: number; // % of referred but never purchased
    currentTier: 'Tier1' | 'Tier2' | 'Tier3' | 'Tier4';
    rank: number; // Among all partners in organization
  };
}
```

**Key Functions**:
- `getDailyMetrics(partnerId)` - Get single partner metrics
- `aggregateDailyMetrics(organizationId)` - Batch process all partners
- `getTopPartners(organizationId, limit)` - Get top performers
- `getPartnerRanking(partnerId)` - Get rank and percentile

**Use Cases**:
- Partner dashboard display (real-time)
- Executive reporting (daily/weekly/monthly)
- Tier calculation input
- Risk scoring input
- Intervention decision-making

**File Location**: `/src/lib/services/partner-analytics-service.ts`

---

### 1.3 Partner Churn Risk Detector

**Purpose**: Identify at-risk partners before they become inactive  
**Frequency**: Daily at 9 AM (cron) + on-demand (API)

**Risk Scoring Algorithm** (0-10 points):

| Signal | Points | Condition | Weight |
|--------|--------|-----------|--------|
| No sales in 7 days | +3 | `lastSale > 7 days` | High |
| No sales in 14 days | +5 | `lastSale > 14 days` | Critical |
| Commission drop 30% | +4 | `commission < 70% of prev month` | High |
| No email opens in 30 days | +2 | `emailOpenedAt < 30 days` | Medium |
| Referred <5 customers | +1 | `contacts.length < 5` | Low |
| Rating <3/5 stars | +3 | `rating < 3` | High |

**Risk Levels**:

| Level | Score | Action | SLA |
|-------|-------|--------|-----|
| GREEN | 0-3 | Weekly newsletter | Ongoing |
| YELLOW | 4-6 | Encouragement + incentive | 2-day follow-up |
| RED | 7+ | Urgent intervention | Immediate |

**Output**:

```typescript
{
  partnerId: string;
  score: number; // 0-10+
  riskLevel: 'GREEN' | 'YELLOW' | 'RED';
  breakdown: {
    noSalesIn7Days: boolean;
    noSalesIn14Days: boolean;
    commissionDrop30Percent: boolean;
    noEmailOpenIn30Days: boolean;
    referredLessThan5: boolean;
    ratingBelow3Stars: boolean;
  };
  previousScore: number;
  previousLevel: 'GREEN' | 'YELLOW' | 'RED';
  changedLevel: boolean;
  lastUpdated: Date;
}
```

**Key Functions**:
- `calculateChurnRisk(partnerId)` - Single partner
- `calculateAllPartnerChurnRisks(organizationId)` - Batch
- `getPartnersByRiskLevel(organizationId, level)` - Filter by risk

**File Location**: `/src/lib/services/partner-churn-detector.ts`

---

### 1.4 Partner Tier System

**Purpose**: Incentivize growth through tiered benefits and commission rates  
**Frequency**: Monthly on 1st (cron) + on-demand (API)

**Tier Structure**:

| Tier | Name | Monthly Commission | Base Rate | Benefits |
|------|------|-------------------|-----------|----------|
| Tier 1 | Platinum | >$20K | 25% | ⭐ Dedicated manager + quarterly bonus + co-marketing |
| Tier 2 | Gold | $5K-$20K | 21% | Dedicated manager + monthly reviews + exclusive offers |
| Tier 3 | Silver | $1K-$5K | 18% | Account manager + monthly newsletters |
| Tier 4 | Bronze | <$1K | 15% | Self-service portal + email support |

**Tier Transitions**:
- Automatic calculation on 1st of each month
- Based on previous month's commission
- Promotions grant new benefits + notification
- Demotions trigger retention offer

**Benefits Distribution**:

```typescript
Tier1: {
  dedicatedManager: true,
  exclusiveOffers: true,
  prioritySupport: true,
  bonus: { quarterly: $1000, annual: $5000 },
  benefits: [
    'Dedicated account manager',
    'Quarterly business review',
    'Custom commission packages',
    'Priority support (24/7)',
    // ... 5 more
  ],
}
```

**Key Functions**:
- `calculateTier(monthlyCommission)` - Get tier from commission
- `updatePartnerTier(partnerId)` - Update and grant benefits
- `calculateAllPartnerTiers(organizationId)` - Monthly batch
- `getTierSummary(organizationId)` - Org-wide distribution
- `getTierBenefits(tier)` - Get specific tier benefits

**File Location**: `/src/lib/services/partner-tier-service.ts`

---

### 1.5 Partner Intervention Service

**Purpose**: Send automated, personalized outreach based on risk level  
**Frequency**: Daily at 10 AM (cron) + manual trigger (API)

**Intervention Types**:

#### GREEN Intervention: Weekly Newsletter

**Cadence**: Every Monday morning  
**Channels**: Email  
**Content**:
- Weekly performance stats
- Success tips (rotating topics)
- Partner spotlight (top performer story)
- Resources & learning materials
- Next milestone encouragement

**Template Variables**:
```
{{partnerName}}, {{weeklySales}}, {{weeklyCommission}},
{{partnerRank}}, {{totalPartners}}, {{tip1}}, {{tip2}},
{{tip3}}, {{spotlightPartner}}, {{spotlightCommission}},
{{spotlightStory}}
```

#### YELLOW Intervention: Win-Back Sequence

**Trigger**: No sales for 7 days (or score 4-6)  
**Cadence**: Day 0 (SMS), Day 2 (email)  
**Goal**: Re-engage with encouragement + incentive

**SMS (Day 0)**:
```
{{partnerName}}, we miss you! No sales in 7 days.
Here's a special boost: +5% commission for 7 days!
Reply YES to activate.
```

**Email (Day 2)**:
```
Subject: We've got a special offer for you! 🎁

- Celebrate progress so far
- Explain commission boost
- Remove barriers to action
- Provide resources
- Emphasize belief in them
```

**Incentive**: +5% commission boost for 7 days (automatic)

#### RED Intervention: Urgent Retention

**Trigger**: No sales for 14 days (or score 7+)  
**Cadence**: Immediate SMS + same day email + scheduled call  
**Goal**: Prevent churn through dedicated attention

**SMS (Immediate)**:
```
{{partnerName}} - URGENT! Account at risk (no sales 14 days).
Let's talk! Special offer: {{offer}}.
Reply CALL or click: [link]
```

**Email (Immediate)**:
```
Subject: Let's talk! 🤝 We want to help

- Acknowledge the gap
- Show we care about their success
- Offer dedicated support
- +10% commission boost for 30 days
- Schedule call
- Provide direct contact
- Remind of past wins
```

**Actions**:
1. SMS + Email sent immediately
2. Support manager assigned
3. Call scheduled within 2 days
4. Temporary commission boost (+10% for 30 days)
5. Weekly check-ins until recovery

**Template Variables**:
```
{{partnerName}}, {{daysNoSales}}, {{offer}},
{{supportPhone}}, {{managerName}}, {{managerEmail}}
```

**Key Functions**:
- `sendGreenIntervention(partnerId, organizationId)` - Newsletter
- `sendYellowIntervention(partnerId, organizationId)` - Win-back
- `sendRedIntervention(partnerId, organizationId)` - Retention
- `sendAutoInterventions(level, organizationId)` - Batch

**File Location**: `/src/lib/services/partner-intervention-service.ts`

---

## 2. Database Schema

### New Models

#### PartnerOnboardingLog

```prisma
model PartnerOnboardingLog {
  id           String   @id @default(cuid())
  partnerId    String
  day          Int      // 1, 3, 7, 14
  emailSent    Boolean  @default(false)
  emailSentAt  DateTime? @db.Timestamptz(6)
  emailOpened  Boolean  @default(false)
  emailOpenedAt DateTime? @db.Timestamptz(6)
  clicked      Boolean  @default(false)
  clickedAt    DateTime? @db.Timestamptz(6)

  partner   Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)

  @@unique([partnerId, day])
  @@index([partnerId, day])
  @@index([emailSent, day])
}
```

### Extended Models

**Partner** - Added relations:
```prisma
onboardingLogs PartnerOnboardingLog[]
```

**Existing Reused Models**:
- `PartnerMetrics` - Monthly commission tracking
- `OnboardingProgress` - Weekly onboarding KPIs
- `PartnerPerformance` - Weekly/monthly KPI aggregation
- `PartnerRiskFlags` - Risk scoring state

---

## 3. API Endpoints

### GET /api/partners/metrics/[id]

Get individual partner metrics and risk score

**Query Parameters**: None  
**Response**:
```json
{
  "partner": {
    "id": "cuid",
    "name": "John Doe",
    "email": "john@example.com",
    "tier": "Tier2",
    "status": "ACTIVE"
  },
  "analytics": {
    "dailyMetrics": {
      "partnerId": "cuid",
      "date": "2026-05-27T00:00:00Z",
      "salesCount": 2,
      "commission": 400,
      "weeklyComparison": {...},
      "monthlyComparison": {...},
      "topCustomers": [...],
      "churnRate": 25.5,
      "currentTier": "Tier2",
      "rank": 12
    },
    "riskScore": {
      "score": 2,
      "level": "GREEN",
      "breakdown": {...},
      "previousLevel": "GREEN",
      "changedLevel": false
    }
  }
}
```

### GET /api/partners/analytics/summary

Get organization-wide analytics

**Query Parameters**:
- `organizationId` (required)

**Response**:
```json
{
  "organization": {
    "id": "cuid",
    "name": "Mabiz CRM"
  },
  "topPartners": [
    {
      "rank": 1,
      "id": "cuid",
      "name": "Sarah Johnson",
      "commission": 25000,
      "sales": 10,
      "tier": "Tier1"
    }
  ],
  "tierDistribution": {
    "Tier1": {
      "count": 2,
      "commission": 50000,
      "percentage": 20.5
    }
  },
  "riskDistribution": {
    "GREEN": 30,
    "YELLOW": 8,
    "RED": 2
  },
  "onboardingStatus": {
    "active": 5,
    "completed": 40,
    "failed": 1
  }
}
```

### POST /api/partners/[id]/intervention

Manually trigger intervention

**Query Parameters**:
- `type` (required): "GREEN" | "YELLOW" | "RED"
- `organizationId` (required)

**Response**:
```json
{
  "success": true,
  "result": {
    "type": "YELLOW",
    "partnerId": "cuid",
    "message": "YELLOW interventions sent",
    "actions": [
      {
        "type": "SMS",
        "partnerId": "cuid",
        "riskLevel": "YELLOW",
        "message": "Encouragement SMS sent"
      },
      {
        "type": "EMAIL",
        "partnerId": "cuid",
        "riskLevel": "YELLOW",
        "message": "Follow-up email scheduled",
        "scheduledFor": "2026-05-29T14:00:00Z"
      }
    ]
  }
}
```

---

## 4. Cron Jobs

### Partner Onboarding (Daily 8 AM)

**Endpoint**: `/api/cron/partner-onboarding`  
**Schedule**: `0 8 * * *`  
**Purpose**: Send Day 1, 3, 7, 14 onboarding emails

**Response**:
```json
{
  "status": "SUCCESS",
  "organizationsProcessed": 12,
  "day1Sent": 5,
  "day3Sent": 4,
  "day7Sent": 3,
  "day14Sent": 1,
  "completed": 1,
  "errors": []
}
```

### Partner Risk Scoring (Daily 9 AM)

**Endpoint**: `/api/cron/partner-risk-scoring`  
**Schedule**: `0 9 * * *`  
**Purpose**: Calculate churn risk for all partners

**Response**:
```json
{
  "status": "SUCCESS",
  "organizationsProcessed": 12,
  "totalPartnersScored": 145,
  "riskDistribution": {
    "GREEN": 110,
    "YELLOW": 25,
    "RED": 10
  },
  "changedToRed": 3,
  "changedToYellow": 5,
  "improved": 2,
  "errors": []
}
```

### Partner Interventions (Daily 10 AM)

**Endpoint**: `/api/cron/partner-interventions`  
**Schedule**: `0 10 * * *`  
**Purpose**: Send interventions based on risk level

**Response**:
```json
{
  "status": "SUCCESS",
  "interventionsByRiskLevel": {
    "GREEN": { "sent": 110, "failed": 0 },
    "YELLOW": { "sent": 25, "failed": 1 },
    "RED": { "sent": 10, "failed": 0 }
  },
  "totalActionsTaken": 165,
  "errors": []
}
```

### Partner Tier Calculation (1st of Month 8 AM)

**Endpoint**: `/api/cron/partner-tier-calc`  
**Schedule**: `0 8 1 * *`  
**Purpose**: Recalculate tiers and grant benefits

**Response**:
```json
{
  "status": "SUCCESS",
  "organizationsProcessed": 12,
  "tierCounts": {
    "Tier1": 3,
    "Tier2": 8,
    "Tier3": 25,
    "Tier4": 109
  },
  "promoted": 5,
  "demoted": 2,
  "errors": []
}
```

---

## 5. Integration Points

### With SMS Service

- **File**: `/src/lib/sms-service.ts`
- **Function**: `sendSmsViaAligo(phone, message)`
- **Used by**: Yellow & Red interventions

### With Email Service

- **File**: `/src/lib/email.ts`
- **Function**: `sendEmail(to, subject, body, scheduledFor?)`
- **Used by**: All interventions + onboarding

### With Prisma ORM

- **File**: `/src/lib/prisma.ts`
- **Models Used**: Partner, PartnerMetrics, PartnerOnboardingLog, PartnerRiskFlags, etc.

### With Logger

- **File**: `/src/lib/logger.ts`
- **Usage**: All services log actions for audit trail

---

## 6. Configuration

### Email Templates

Stored in service files with template variables:
- `/src/lib/services/partner-onboarding-service.ts` - Onboarding templates (Day 1, 3, 7, 14)
- `/src/lib/services/partner-intervention-service.ts` - Intervention templates (Green, Yellow, Red)

### SMS Templates

Inline in intervention service with variable substitution:
- Green: Weekly stats summary (short)
- Yellow: "We miss you" + incentive
- Red: "Let's talk" + urgent offer

### Rate Limiting

Partners are not rate-limited for critical interventions (Red).  
Green/Yellow follow normal SMS/email rate limits.

---

## 7. Monitoring & Alerts

### Key Metrics to Monitor

1. **Onboarding Completion Rate**
   - Target: >90% of started onboardings complete
   - Alert: <80% weekly completion

2. **Risk Distribution**
   - Target: <10% RED, <25% YELLOW, >65% GREEN
   - Alert: >15% RED or >40% YELLOW

3. **Intervention Response Rate**
   - Target: >40% of Yellow interventions → Green
   - Alert: <25% conversion

4. **Tier Promotion Rate**
   - Target: 5-10% per month
   - Alert: 0% or >20%

### Logging

All actions logged with context:
- `partnerId`, `organizationId`, `action`, `timestamp`
- `result` (success/failure), `duration`
- Error details for troubleshooting

---

## 8. Future Enhancements

1. **Partner Ratings System**
   - Collect ratings from customers
   - Use in risk scoring (6th signal)
   - Display in partner dashboard

2. **Performance Bonuses**
   - Tier bonuses (quarterly/annual)
   - Milestone bonuses (every $5K in commission)
   - Co-marketing bonuses

3. **Partner Dashboard**
   - Real-time metrics display
   - Historical performance charts
   - Resource library access
   - Commission calculator

4. **Advanced Analytics**
   - Customer acquisition cost by partner
   - Lifetime value by partner tier
   - Cohort analysis (onboarding cohorts)
   - Predictive churn modeling

5. **Communication Preferences**
   - Allow partners to choose frequency
   - Support multiple channels (SMS, Email, Slack, Discord)
   - Personalize content preferences

---

## 9. Support & Troubleshooting

### Common Issues

**Issue**: Onboarding emails not sending  
**Fix**: Check `OrgEmailConfig` is configured and active

**Issue**: SMS not sent in Red intervention  
**Fix**: Verify `OrgSmsConfig` is active and has Aligo credentials

**Issue**: Risk scores not updating  
**Fix**: Run `/api/cron/partner-risk-scoring` manually or check logs

**Issue**: Tier not promoted despite high commission  
**Fix**: Ensure `PartnerMetrics` is being recorded for the month

### Support Contacts

- **Technical Issues**: engineering@partner.support
- **Partner Questions**: success@partner.support
- **Escalations**: vp-partnerships@company.com

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-27  
**Next Review**: 2026-06-27
