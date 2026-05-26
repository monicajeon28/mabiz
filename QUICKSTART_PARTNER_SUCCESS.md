# Partner Success Automation - Quick Start Guide

**Setup Time**: 15 minutes  
**Deployment**: 5 minutes  
**Testing**: 10 minutes

## Overview

The Partner Success Automation system includes:

1. ✅ **Partner Onboarding** (14-day automated email sequence)
2. ✅ **Risk Scoring** (10-point algorithm detecting at-risk partners)
3. ✅ **Interventions** (GREEN/YELLOW/RED automated outreach)
4. ✅ **Tier Management** (4-tier system with benefits)
5. ✅ **Analytics** (Real-time partner metrics)

---

## 1. Database Migration

### Step 1: Create New Model

The `PartnerOnboardingLog` model has been added to `prisma/schema.prisma`:

```bash
# Check that the model exists
grep "PartnerOnboardingLog" prisma/schema.prisma
```

### Step 2: Run Migration

```bash
# Generate and apply migration
npx prisma migrate dev --name add_partner_onboarding_log

# Or if using Neon/managed database
npx prisma migrate deploy
```

**Output** (expected):
```
✓ Generated migration `migrations/xxx_add_partner_onboarding_log/migration.sql`
✓ Database has been synchronized
```

### Step 3: Verify

```bash
# Check that table was created
npx prisma studio
# Look for "PartnerOnboardingLog" in the sidebar
```

---

## 2. Environment Setup

### Step 1: Verify Email Configuration

Check that `OrgEmailConfig` is set up for your organization:

```bash
# In your Prisma Studio or directly
# SELECT * FROM "OrgEmailConfig" WHERE organizationId = 'your-org-id'
```

**If not set up**, configure email:
1. Go to Organization Settings
2. Add SMTP credentials (Gmail, SendGrid, etc.)
3. Save configuration

### Step 2: Verify SMS Configuration

Check that `OrgSmsConfig` is set up:

```bash
# SELECT * FROM "OrgSmsConfig" WHERE organizationId = 'your-org-id'
```

**Requires**:
- Aligo API Key
- Aligo User ID
- Sender Phone Number (verified)

### Step 3: Test APIs

```bash
# Test email
curl -X POST http://localhost:3000/api/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "subject": "Test"}'

# Test SMS
curl -X POST http://localhost:3000/api/test/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "+82-10-xxxx-xxxx", "message": "Test"}'
```

---

## 3. Deploy Cron Jobs

### Step 1: Update vercel.json

The cron jobs have been added to `vercel.json`:

```json
{
  "path": "/api/cron/partner-onboarding",
  "schedule": "0 8 * * *"  // Daily at 8 AM
},
{
  "path": "/api/cron/partner-risk-scoring",
  "schedule": "0 9 * * *"  // Daily at 9 AM
},
{
  "path": "/api/cron/partner-interventions",
  "schedule": "0 10 * * *"  // Daily at 10 AM
},
{
  "path": "/api/cron/partner-tier-calc",
  "schedule": "0 8 1 * *"  // 1st of month at 8 AM
}
```

### Step 2: Verify Cron Configuration

```bash
# Check vercel.json has the crons
cat vercel.json | grep "partner"

# Output should show:
# /api/cron/partner-onboarding
# /api/cron/partner-risk-scoring
# /api/cron/partner-interventions
# /api/cron/partner-tier-calc
```

### Step 3: Test Crons Locally

```bash
# Test partner onboarding cron
curl -X POST http://localhost:3000/api/cron/partner-onboarding \
  -H "Authorization: Bearer cron-secret"

# Test risk scoring cron
curl -X POST http://localhost:3000/api/cron/partner-risk-scoring \
  -H "Authorization: Bearer cron-secret"

# Test interventions cron
curl -X POST http://localhost:3000/api/cron/partner-interventions \
  -H "Authorization: Bearer cron-secret"

# Test tier calculation cron (simulating 1st of month)
curl -X POST http://localhost:3000/api/cron/partner-tier-calc \
  -H "Authorization: Bearer cron-secret"
```

### Step 4: Deploy

```bash
# Commit changes
git add prisma/schema.prisma vercel.json \
  src/lib/services/partner-*.ts \
  src/app/api/cron/partner-* \
  src/app/api/partners/*

git commit -m "feat(partners): Partner Success Automation system with onboarding, risk scoring, interventions, and tier management"

# Push to deploy
git push origin main
```

---

## 4. Start Partner Onboarding

### Manual Start

Start onboarding for a specific partner:

```bash
# Via API
curl -X POST "http://localhost:3000/api/partners/{partnerId}/onboarding/start" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"

# Or in code
import { startPartnerOnboarding } from '@/lib/services/partner-onboarding-service';

await startPartnerOnboarding('partner-id-here');
```

### Automatic Start

Partners automatically start onboarding when:
1. Created via Partner API with `onboardingStatus = "IN_PROGRESS"`
2. Webhook triggers onboarding start
3. Manual trigger via admin dashboard

### Track Onboarding Progress

```bash
# Get onboarding status
curl -X GET "http://localhost:3000/api/partners/{partnerId}/onboarding/progress" \
  -H "Authorization: Bearer your-token"

# Response shows:
# {
#   "partnerId": "xxx",
#   "status": "IN_PROGRESS",
#   "daysInOnboarding": 5,
#   "nextEmail": "Day 7 milestone",
#   "scheduledFor": "2026-05-29T08:00:00Z"
# }
```

---

## 5. Monitor Risk Scores

### Real-Time Dashboard

Visit partner analytics dashboard:

```
https://your-domain.com/dashboard/partners/analytics
```

Shows:
- Top 10 partners by commission
- Risk distribution (GREEN/YELLOW/RED)
- Tier distribution
- Onboarding status

### Individual Partner Metrics

```bash
# Get risk score for specific partner
curl -X GET "http://localhost:3000/api/partners/{partnerId}/metrics" \
  -H "Authorization: Bearer your-token"

# Response:
# {
#   "partner": {
#     "id": "xxx",
#     "name": "John Doe",
#     "tier": "Tier2",
#     "status": "ACTIVE"
#   },
#   "analytics": {
#     "dailyMetrics": { ... },
#     "riskScore": {
#       "score": 2,
#       "level": "GREEN",
#       "breakdown": { ... },
#       "changedLevel": false
#     }
#   }
# }
```

### Organization Summary

```bash
# Get all partners summary
curl -X GET "http://localhost:3000/api/partners/analytics/summary?organizationId={orgId}" \
  -H "Authorization: Bearer your-token"
```

---

## 6. Trigger Manual Interventions

### Trigger GREEN (Newsletter)

```bash
curl -X POST "http://localhost:3000/api/partners/{partnerId}/intervention?type=GREEN&organizationId={orgId}" \
  -H "Authorization: Bearer your-token"
```

**Result**: Sends weekly newsletter immediately

### Trigger YELLOW (Win-back)

```bash
curl -X POST "http://localhost:3000/api/partners/{partnerId}/intervention?type=YELLOW&organizationId={orgId}" \
  -H "Authorization: Bearer your-token"
```

**Result**:
1. SMS sent immediately
2. Email scheduled for 2 days later
3. +5% commission boost activated

### Trigger RED (Urgent)

```bash
curl -X POST "http://localhost:3000/api/partners/{partnerId}/intervention?type=RED&organizationId={orgId}" \
  -H "Authorization: Bearer your-token"
```

**Result**:
1. SMS sent immediately
2. Email sent immediately
3. Support call scheduled
4. +10% commission boost for 30 days

---

## 7. Testing Checklist

- [ ] Migration ran successfully
- [ ] Email service configured and tested
- [ ] SMS service configured and tested
- [ ] Cron jobs registered in vercel.json
- [ ] Crons tested locally and return 200
- [ ] Started onboarding for 1 test partner
- [ ] Day 1 email sent (check email service)
- [ ] Risk score calculated (check /api/partners/metrics/[id])
- [ ] Manual intervention triggered (check logs)
- [ ] Partner analytics summary working
- [ ] Database queries optimized (check indexes)
- [ ] Error handling tested (simulate failures)

---

## 8. Common Tasks

### Add Partner to Onboarding

```typescript
import { startPartnerOnboarding } from '@/lib/services/partner-onboarding-service';

const partner = await startPartnerOnboarding(partnerId);
console.log('Onboarding started for:', partner.name);
```

### Get Partner Risk Score

```typescript
import { calculateChurnRisk } from '@/lib/services/partner-churn-detector';

const risk = await calculateChurnRisk(partnerId);
console.log(`Risk: ${risk.riskLevel} (${risk.score} points)`);
```

### Update Partner Tier

```typescript
import { updatePartnerTier } from '@/lib/services/partner-tier-service';

const result = await updatePartnerTier(partnerId);
console.log(`Tier: ${result.newTier} (from ${result.oldTier})`);
```

### Send Intervention

```typescript
import { sendYellowIntervention } from '@/lib/services/partner-intervention-service';

const actions = await sendYellowIntervention(partnerId, organizationId);
console.log(`Actions taken: ${actions.length}`);
```

### Get Org Summary

```typescript
import { getTopPartners } from '@/lib/services/partner-analytics-service';

const topPartners = await getTopPartners(organizationId, 10);
topPartners.forEach((p) => {
  console.log(`${p.rank}. ${p.partner.name}: $${p.commission}`);
});
```

---

## 9. Troubleshooting

### Issue: Onboarding emails not sending

**Cause**: Email config not set up or template error

**Fix**:
```bash
# Check email config
npx prisma studio
# Look for OrgEmailConfig record with isActive=true

# Check service logs
tail -f logs/sms-service.log
tail -f logs/email-service.log
```

### Issue: Risk scores not updating

**Cause**: Cron not running or calculation error

**Fix**:
```bash
# Test cron manually
curl -X POST http://localhost:3000/api/cron/partner-risk-scoring

# Check logs
grep "partner-risk-scoring" logs/cron.log

# Verify Prisma connection
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Partner\";"
```

### Issue: Interventions not triggering

**Cause**: Partner not in correct risk level or SMS/email disabled

**Fix**:
```bash
# Check partner risk level
curl http://localhost:3000/api/partners/{id}/metrics

# Check SMS/email configs
npx prisma studio
# Verify OrgSmsConfig.isActive = true
# Verify OrgEmailConfig.isActive = true
```

### Issue: Tier not updating

**Cause**: PartnerMetrics not being recorded

**Fix**:
```bash
# Check metrics exist
SELECT * FROM "PartnerMetrics" WHERE "partnerId" = 'xxx' ORDER BY "createdAt" DESC;

# If empty, ensure commission is being tracked somewhere
SELECT * FROM "Partner" WHERE id = 'xxx';
```

---

## 10. Monitoring in Production

### Set Up Alerts

Use your monitoring service (Sentry, DataDog, etc.) to alert on:

```
# Alert when cron fails
error.message CONTAINS "partner-risk-scoring" AND status != 200

# Alert when intervention fails
error.message CONTAINS "intervention" AND type = "error"

# Alert when churn spike
metric.RED_partners > previous_day * 1.5

# Alert when low intervention response
metric.intervention_response_rate < 0.3
```

### Daily Review

```bash
# Email daily summary
0 18 * * * curl -s http://localhost:3000/api/cron/partner-risk-scoring \
  | jq '.' | mail -s "Daily Partner Risk Report" team@company.com
```

### Weekly Metrics

Check:
- Total partners in each risk level
- Onboarding completion rate (target: >90%)
- Intervention response rate (target: >40%)
- Tier distribution (ensure healthy mix)
- Churn rate (target: <40% annual)

---

## 11. Next Steps

After 1 week of monitoring:

1. **Review baseline metrics**
   - How many partners are RED?
   - What's the onboarding completion rate?
   - Are interventions being triggered?

2. **Adjust templates**
   - If email open rate <30%, refresh subject lines
   - If SMS opt-out rate >5%, reduce frequency
   - If intervention response <30%, reconsider incentives

3. **Implement Phase 2** (optional):
   - Partner ratings system
   - Seasonal partner adjustments
   - Customer rating integration
   - Advanced analytics dashboard

4. **Scale & optimize**
   - Monitor intervention ROI
   - A/B test templates
   - Refine risk scoring
   - Plan Q3 enhancements

---

## 12. Support & Resources

**Documentation**:
- `/docs/PARTNER_SUCCESS_SPEC.md` - Full specification
- `/docs/PARTNER_CHURN_DETECTION.md` - Risk scoring methodology
- Code comments in service files

**Key Files**:
```
src/lib/services/
├── partner-onboarding-service.ts       (900 lines)
├── partner-analytics-service.ts        (350 lines)
├── partner-churn-detector.ts           (280 lines)
├── partner-tier-service.ts             (400 lines)
└── partner-intervention-service.ts     (350 lines)

src/app/api/cron/
├── partner-onboarding/                 (100 lines)
├── partner-risk-scoring/               (100 lines)
├── partner-interventions/              (120 lines)
└── partner-tier-calc/                  (100 lines)

src/app/api/partners/
├── metrics/[id]/                       (60 lines)
├── analytics/summary/                  (100 lines)
└── [id]/intervention/                  (70 lines)
```

**Contact**:
- Issues: engineering@company.com
- Partners: success@company.com
- Leadership: vp-partnerships@company.com

---

**Last Updated**: 2026-05-27  
**Next Review**: 2026-06-27
