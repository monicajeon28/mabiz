# Deploy Daily Performance Reporting - Quick Reference

## Status: ✅ Code Complete, Ready to Deploy

**All code is written and ready. Follow these steps to deploy:**

---

## 5-Minute Deployment

### 1️⃣ Database Migration (2 minutes)

```bash
cd D:\mabiz-crm

# Run migration
npx prisma migrate dev --name add_daily_report_model

# Generate client
npx prisma generate
```

Expected output: Migration successful, DailyReport table created

### 2️⃣ Environment Variables (1 minute)

Add to `.env.local` (get values from team):

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_WEBHOOK_DAILY_REPORT=https://hooks.slack.com/services/...
NEXT_PUBLIC_APP_URL=https://app.mabiz.com
EMAIL_API_KEY=SG.xxxxx (optional, if using SendGrid)
EMAIL_API_URL=https://api.sendgrid.com/v3/mail/send (optional)
```

### 3️⃣ Git Commit (1 minute)

```bash
git add -A
git commit -m "feat(analytics): Daily Performance Reporting System (TASK 6-2)"
git push origin main
```

### 4️⃣ Vercel Configuration (1 minute)

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/daily-performance-report",
    "schedule": "0 6 * * *"
  }]
}
```

Then redeploy (Vercel auto-detects and registers cron).

---

## Test It (3 minutes)

### Manual Trigger

```bash
# Get CRON_SECRET from Vercel dashboard (Settings → Environment Variables)
export CRON_SECRET="your-secret-here"

curl -X GET https://app.mabiz.com/api/cron/daily-performance-report \
  -H "x-vercel-cron-secret: $CRON_SECRET"
```

Expected response:
```json
{
  "ok": true,
  "message": "Daily performance report generated",
  "results": {
    "generated": 2,
    "failed": 0
  }
}
```

### Verify Each Channel

**Email**: Check inbox (sent to all ADMIN + TEAM_LEAD members)

**Slack**: Check `#sales-metrics` (post appears automatically)

**Dashboard**: Visit `/analytics/reports` (table displays all reports)

---

## What Gets Created (Automatic)

✅ **Daily at 6 AM**:
- `DailyReport` record in database
- Email to team
- Slack post
- Critical alerts (if any)

✅ **User-accessible**:
- Dashboard widget (shows today's metrics)
- Report history page (filterable by date)
- CSV export (downloadable)
- API endpoints (JSON)

---

## Troubleshooting

### Email not arriving?
1. Check org has ADMIN/TEAM_LEAD members
2. Verify EMAIL_API_KEY is set
3. Check spam folder
4. Manually trigger cron above

### Slack not posting?
1. Verify SLACK_WEBHOOK_URL is set
2. Test webhook manually
3. Check bot has permission to post

### Metrics seem wrong?
1. Check Contact + AffiliateSale data is complete
2. Verify SmsLog records exist
3. Check date/timezone settings

---

## Files to Know About

| File | Purpose | Key Takeaway |
|------|---------|--------------|
| `src/lib/services/daily-report-service.ts` | Report generation | Main logic for calculating metrics |
| `src/lib/services/performance-alerts.ts` | Alert detection | Thresholds + anomaly detection |
| `src/lib/services/slack-daily-report.ts` | Slack formatting | Creates Block Kit messages |
| `src/lib/templates/daily-report-email.ts` | Email HTML | Responsive design |
| `src/app/api/cron/daily-performance-report/route.ts` | Cron executor | Batch processes all orgs |
| `src/app/(dashboard)/analytics/reports/page.tsx` | Report history | UI for viewing past reports |

---

## Configuration Reference

### Alert Thresholds (Can Customize)

In `performance-alerts.ts`:

```typescript
dailyRevenue: { min: 5000, criticalDrop: -30 }
conversionRate: { min: 2.0, target: 3.0 }
smsOpenRate: { min: 20, target: 25 }
```

### Cron Schedule

Current: **0 6 * * * = 6 AM daily**

To change:
- Edit `vercel.json`
- Redeploy

### Email Recipients

Auto-includes all users with role:
- `ADMIN`
- `OWNER`
- `TEAM_LEAD`

---

## Monitoring (Daily)

At 6 AM each day:

1. Check `#sales-metrics` for new message
2. Confirm email arrived
3. Review metrics for anomalies
4. Check for RED alerts

---

## Next: Iterate (After Deployment)

**Week 1**:
- ✅ Verify first report (6 AM)
- ✅ Confirm email/Slack delivery
- ✅ Get team feedback

**Week 2**:
- Customize alert thresholds if needed
- Gather usage metrics

**Month 1**:
- Add threshold management UI
- Create trending dashboard
- Implement recommendation tracking

---

## Questions?

See detailed docs:
- **User Guide**: `QUICKSTART_DAILY_REPORTS.md`
- **Technical Spec**: `docs/DAILY_REPORTING_SPEC.md`
- **Implementation Details**: `TASK_6-2_IMPLEMENTATION_SUMMARY.md`

---

**Status**: ✅ Ready to deploy | **Estimated time**: 10 minutes
