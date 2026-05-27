# Quick Start: Daily Performance Reports (TASK 6-2)

**Goal**: Understand and use the daily reporting system in 10 minutes

---

## ⚡ 30-Second Overview

Every day at **6 AM**, the system:
1. Generates comprehensive performance metrics
2. Detects anomalies & alerts
3. Sends email + Slack updates
4. Makes data available on dashboard

**Users see**: Beautiful email with key metrics → Click to view full report → Drill down by date

---

## 🚀 What You Get

### Email Report (HTML)

Sent to all admins + team leads at 6 AM

```
┌─────────────────────────────────┐
│ 📊 Daily Performance Report     │
│ 2026-05-27                      │
├─────────────────────────────────┤
│ 💰 Revenue: $18,500 (+12%)      │
│ 📈 Conversion: 3.2% (+0.5pp)    │
│ 📱 SMS Open: 22.5% vs 25% ✓     │
│ 📧 Email Open: 18.3% vs 15% ✓   │
├─────────────────────────────────┤
│ ⚠️ WARNINGS (2)                  │
│  - SMS open rate slightly below  │
│  - Email completion at risk      │
├─────────────────────────────────┤
│ ⭐ TOP PARTNERS                  │
│  1. John Doe: $2,500             │
│  2. Jane Smith: $1,800           │
├─────────────────────────────────┤
│ 💡 RECOMMENDATIONS               │
│  - Increase Day 0 SMS budget     │
│  - Test new email subject line   │
│  - Celebrate top partner win     │
├─────────────────────────────────┤
│      [VIEW FULL REPORT]          │
└─────────────────────────────────┘
```

### Slack Message

Posted to `#sales-metrics` at 6 AM

```
📊 Daily Performance: 05-27
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Revenue: $18,500 (+12%)
📈 Conversion: 3.2% (+0.5pp)
📧 Day 0 Open: 22.5%
✅ Sequences: 68.3% complete

Channel Performance:
📱 SMS: Open 22.5%, Click 5.2%
💬 Kakao: Open 18.1%, Click 4.1%
📨 Email: Open 18.3%, Click 3.7%

⭐ Top Partner: John Doe +$2,500

⚠️ WARNINGS (2)
💡 View recommendations →
```

### Dashboard Widget

Visible on analytics home page, real-time refresh

```
Today's Performance
━━━━━━━━━━━━━━━━━━━━━━
[💰 $18,500]  [📈 3.2%]  [📱 22.5%]  [📧 18.3%]

[⚠️ 2 Warnings ▼]
 - SMS open rate at 22.5% (target 25%)
 - Email completion rate declining

[⭐ 3 Top Partners ▼]
 1. John Doe: $2,500
 2. Jane Smith: $1,800
 3. Bob Lee: $1,200

[💡 3 Recommendations ▼]
 - Increase Day 0 SMS
 - Test new email CTA
 - Celebrate John Doe

[View all reports →]
```

### Report History Page

Interactive table at `/analytics/reports`

```
Date          Revenue   Conversion  Alerts  Top Partner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2026-05-27    $18,500   3.2%        2       John Doe      [+]
2026-05-26    $16,200   2.8%        1       Jane Smith    [+]
2026-05-25    $21,300   3.5%        0       Bob Lee       [+]
...

Filter: [7 days] [30 days] [90 days]
[⬇️ Export CSV]
```

---

## 📊 Key Metrics Explained

### Summary
- **Revenue**: Total sales value today
- **Conversion Rate**: % of leads that became customers
- **Day 0 Open Rate**: % of initial messages opened
- **Sequence Completion**: % of Day 0-3 series finished

### Alerts (Red = Critical, Yellow = Warning)
- **Revenue < $5K** → Red alert, check sales funnel
- **Conversion < 2%** → Yellow alert, improve offer
- **SMS Open < 20%** → Yellow alert, test subject lines
- **No Sales 7+ Days** → Yellow alert, partner at risk

### Recommendations (AI-Generated)
- "Increase Day 0 budget (35% open rate)"
- "SMS outperforming email (5.2% vs 2.1% conversion)"
- "Partner {{name}} at risk (no sales 3 days)"
- "Celebrate {{name}} (highest revenue today)"

---

## 🎯 For Different Users

### 👨‍💼 CEO / Founder

**What to look for**:
1. **Revenue trend** (top metric)
2. **RED alerts** (immediate action needed)
3. **Top partners** (celebrate + learn from)
4. **Forecast** (projected month-end revenue)

**Action**: If RED alert → call sales lead for 5-min discussion

---

### 📊 Sales Manager

**What to look for**:
1. **Conversion rate** (team KPI)
2. **Channel comparison** (SMS vs Email performance)
3. **Top performers** (coaching opportunity)
4. **Recommendations** (specific actions)

**Action**: Share recommendations in daily standup (6:15 AM)

---

### 📱 Marketing Manager

**What to look for**:
1. **SMS metrics** (your channel)
2. **Email metrics** (team's channel)
3. **Open/click rates** (campaign performance)
4. **Recommendations** (A/B test suggestions)

**Action**: Run recommended A/B test same day

---

### 👥 Team Member

**What to look for**:
1. **How you're contributing** (your partner revenue)
2. **Your channel metrics** (SMS/Email open rates)
3. **Congratulations** (if you're top performer)

**Action**: Get motivated by data + celebrate wins

---

## 🔧 Configuration

### Email Recipients

**Automatically sent to**:
- Organization admins
- Team leads
- Can customize in settings

### Email Schedule

- **Time**: 6 AM daily (before standup)
- **Timezone**: Based on organization setting
- **Can change**: Settings → Notifications

### Alert Thresholds

**Default**:
- Revenue minimum: $5,000/day
- Conversion target: 3%
- SMS open target: 25%

**Customize** (coming soon):
- Settings → Performance → Thresholds
- Adjust per your business

### Slack Channel

- **Default**: #sales-metrics
- **Critical**: #sales-alerts (for RED alerts)
- **Configure**: Settings → Slack Integration

---

## 📱 How to Use Dashboard Widget

### On Analytics Home Page

1. **See Today's Metrics**
   - Top row: 4 key numbers
   - Updates every 30 minutes

2. **Expand Sections**
   - Click card title to see details
   - Expand alerts, partners, recommendations

3. **Drill Down**
   - Click "View all reports" → History page
   - Select date → see full breakdown

4. **Export Report**
   - History page → "Export CSV"
   - Open in Excel for custom analysis

---

## 🔍 Report History Page

### Filter & Browse

```
[7 days] [30 days] [90 days]
                            [⬇️ Export]
```

### Expand Report Details

Click row to see:
- Full metrics breakdown
- All alerts (with explanations)
- All recommendations
- Top partners + sequences
- Channel performance

### Export to CSV

Perfect for:
- Monthly reviews
- Board presentations
- Trend analysis

---

## 🚨 Alert Examples

### Red Alert: Revenue Critical

```
🔴 CRITICAL: Revenue $2,300 (-52% drop)
   Action: Investigate system issues or campaign changes
   • Check if SMS campaign ran
   • Verify conversion funnel
   • Call sales lead for update
```

**What to do**: Call immediately, check dashboard for issues

---

### Yellow Alert: Conversion Below Target

```
🟡 WARNING: Conversion 1.8% below 2% target
   Action: Review landing page or value prop
   • Run A/B test on CTA
   • Check competitor pricing
   • Update testimonials
```

**What to do**: Add to standup discussion, plan experiment

---

### Yellow Alert: Partner at Risk

```
🟡 WARNING: Partner John Doe (no sales 7 days)
   Action: Send encouragement + special offer
   • Send personal message
   • Offer $500 bonus for next sale
   • Schedule coaching call
```

**What to do**: Reach out within 24 hours

---

## 💡 Example Recommendations

### 1. Budget Optimization

> "Increase Day 0 Message Budget: Highest open rate at 35%"

**Impact**: Could increase daily revenue by 5-10%

**Action**:
1. Check Day 0 current budget
2. Increase allocation by 20%
3. Monitor for next 7 days
4. Compare results

---

### 2. Channel Shift

> "SMS Outperforming Email: 5.2% vs 2.1% conversion"

**Impact**: Could improve overall conversion by 2-3%

**Action**:
1. Move 20% of email budget to SMS
2. A/B test both channels
3. Measure for 14 days
4. Make permanent decision

---

### 3. Partner Celebration

> "Partner John Doe generated $2,500 today (highest)"

**Impact**: Motivate other partners + learn from success

**Action**:
1. Send congratulations message
2. Ask John: "What worked today?"
3. Share technique with team
4. Consider promotion/incentive

---

## ❓ FAQ

**Q: What if I don't see an email?**
A: 
1. Check spam folder
2. Verify you're on recipient list (Settings → Notifications)
3. Check if report generation failed (see API logs)

**Q: Can I change email time?**
A: Yes → Settings → Notifications → Report Time (coming soon)

**Q: What if alert thresholds don't fit my business?**
A: Settings → Performance → Thresholds (coming soon)

**Q: Can I share reports externally?**
A: Yes → History page → Export CSV → Share with stakeholders

**Q: Is my data private?**
A: Yes → All data per-organization → No cross-org data → Encrypted

---

## 🎓 Learning Path

**Beginner** (5 min):
1. Read this file
2. Check email this morning
3. View dashboard widget

**Intermediate** (15 min):
1. Explore History page
2. Expand 3 reports
3. Understand alert types
4. Share with team

**Advanced** (30 min):
1. Understand recommendation logic
2. Customize thresholds
3. Track trend over 30 days
4. Make data-driven decisions

---

## 📞 Troubleshooting

### Email Not Arriving

**Check**:
1. Is organization active? (Settings → Organization)
2. Are you ADMIN or TEAM_LEAD? (Settings → Members)
3. Is email configured? (Settings → Email Config)

**Fix**:
```bash
# Manual trigger
curl https://app.mabiz.com/api/cron/daily-performance-report \
  -H "x-vercel-cron-secret: $SECRET"
```

### Metrics Look Wrong

**Check**:
1. Is data complete? (check Contact table)
2. Are sales recorded? (check AffiliateSale table)
3. Are SMS/emails being tracked? (check SmsLog)

**Fix**: Contact support with screenshot

### Slack Not Posting

**Check**:
1. Is webhook URL configured? (Settings → Slack)
2. Test webhook manually

**Fix**: Reconfigure webhook + manually trigger

---

## 🚀 Next Steps

1. **Today**: Review morning email
2. **This week**: Share report with team
3. **Next week**: Make one recommendation change
4. **Next month**: Compare metrics vs baseline

---

**Questions?** Contact: support@mabiz.com | `#support` on Slack

**See also**: [Full Documentation](./docs/DAILY_REPORTING_SPEC.md)
