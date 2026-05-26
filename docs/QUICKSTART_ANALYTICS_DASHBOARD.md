# Quickstart: Unified Performance Dashboard

**For**: Sales Leaders, Marketing Managers, Operations Team  
**Time to Learn**: 10 minutes  
**Target User**: Anyone with GLOBAL_ADMIN, OWNER, or AGENT role

## What is This?

The **Unified Performance Dashboard** shows you 4 critical systems at a glance:

1. **Psychology Lenses** (L0-L10): Which customer segments are converting best?
2. **Day 0-3 SMS**: How effective are your automated message sequences?
3. **A/B Tests**: Which variations are winning?
4. **Multi-Channel Performance**: Which channels (SMS, Kakao, Email) give best ROI?

**Bottom Line**: Make data-driven decisions about who to target, what to say, and how to say it.

---

## How to Access

1. Login to mabiz CRM
2. Click **Analytics** → **Performance Analytics** in sidebar
3. See 5 tabs: Overview | Lens | Day 0-3 | A/B Tests | Channels

**URL**: `/analytics/performance`

---

## Tab Guide (5 Tabs)

### Tab 1: Overview (📈 Dashboard Hero)

**What You See**:
- 4 big numbers at top (Revenue, Conversion Rate, Active Sequences, Open Rate)
- 2 charts in middle (Revenue trend, PASONA funnel)
- 3 leaderboards at bottom (Top lenses, sequences, tests)

**What It Means**:

| Metric | Formula | Good Target | Action If Low |
|--------|---------|-------------|---------------|
| **Total Revenue (This Month)** | Conversions × ₩100K | Trending up | Check Day 0-3 data |
| **Conversion Rate** | Conversions / Total Sequences | 15-25% | Test different lenses |
| **Active Sequences** | Day 0-3 sequences in flight | 100+ | Deploy more sequences |
| **Avg Open Rate** | All opens / All sent | 35%+ | Test subject lines |

**Quick Actions**:
- 📊 Click chart legend to show/hide series
- 📥 Click "Export Report" to download CSV
- 📅 Change date range (7/14/30/90 days)

---

### Tab 2: Lens Analytics (🎯 Psychology Segments)

**What You See**:
- Color grid: Each lens (L0-L10) shows revenue, conversion, and LTV
- Sortable table: Compare lenses side-by-side
- Radar chart: Visual comparison of all lenses
- Pie chart: Distribution of customers by lens
- Growth projection: "If L6 grows 10%, +$35K/month"

**What Each Lens Means**:

```
L0: Inactive (churned 3-6 months+)
L1: Price Objection ("Too expensive")
L2: Preparation Anxiety ("Too complicated")
L3: Differentiation ("Competitors are better")
L4: Feature Complexity ("Too many features")
L5: Self-Projection ("Not for me")
L6: Timing/Loss Aversion ("Wrong time to buy")
L7: Companion Persuasion ("Need spouse's approval")
L8: Repurchase/Habit ("Bought before, not again")
L9: Health/Safety/Medical ("Health/medical concerns")
L10: Immediate Purchase Decision ("Ready to buy now")
```

**How to Read the Table**:

```
L6 | 125 contacts | 25% conversion | ₩800K LTV | ₩2M monthly | +1.5% trend ↑
    └─ Best lens! Growing!
    └─ Each contact worth ₩800K lifetime
    └─ Generating ₩2M/month
    └─ Growing faster than average
```

**Quick Actions**:
- **Sort by**: Revenue (default), Conversion Rate, or LTV
- **Click lens row**: (Coming soon) See all contacts in that lens
- **Read projection**: If this lens grows 10%, expect +$X additional revenue

**Pro Tips**:
1. Focus on L6 & L10 (buying decisions) - highest ROI
2. L0 & L1 (inactive & price objectors) - secondary priority
3. If L6 is low, test time-sensitive offers ("This weekend only")
4. If L1 is high, emphasize value/ROI in messaging

---

### Tab 3: Day 0-3 Analytics (📅 SMS Sequence Performance)

**What You See**:
- 4 cards: Day 0, 1, 2, 3 with metrics
- Leaderboard: Top sequences ranked by open rate
- Funnel chart: Drop-off from Day 0 → Day 3
- Prediction: Sequences completing in next 3 days

**What Each Day Means** (PASONA stages):

```
Day 0: Problem + Agitate (P+A)
       ↓ "Your [PROBLEM] is costing you [LOSS]"
       
Day 1: Solution (S)
       ↓ "Here's the proven solution: [OFFER]"
       
Day 2: Offer + Narrow (O+N)
       ↓ "[SPECIFIC OFFER] for [NARROW SEGMENT]"
       
Day 3: Action (A)
       ↓ "Click [CTA] by [DEADLINE] or lose [SCARCITY]"
```

**How to Read**:

```
Day 0: 1,000 sent | 400 opened (40%) | 120 clicked (12%) | 60 converted (6%)

↓ Day 1: 950 sent | 380 opened (40%) | 114 clicked (12%) | ...
↓ Day 2: 850 sent | 340 opened (40%) | 102 clicked (12%) | ...
↓ Day 3: 750 sent | 300 opened (40%) | 90 clicked (12%) | 30 converted (4%)

RESULT: 50% drop-off from Day 0→3 (normal: 40-60%)
```

**Sequence Leaderboard Table**:

```
Sequence Name         | Deployed   | Sent  | Opened | Clicked | Open Rate
─────────────────────┼────────────┼───────┼────────┼─────────┼──────────
L6 Timing + Urgency   | 2026-05-20 | 1,000 | 420    | 145     | 42.0% ✓ Best!
L10 Immediate Action  | 2026-05-18 | 850   | 306    | 122     | 36.0%
L1 Price Value        | 2026-05-15 | 720   | 259    | 78      | 36.0%
```

**Quick Actions**:
- **Filter by**: All, Active, Completed, Paused
- **Sort by**: Open Rate (default), Sent count, Conversions
- **Read funnel**: See where sequences are dropping off

**Pro Tips**:
1. **Open Rate 35%+**: Good. Keep messaging same.
2. **Open Rate 25-35%**: OK. Test subject lines.
3. **Open Rate <25%**: Poor. Change Day 0 or timing.
4. **Click Rate <10%**: CTA weak. Add urgency/scarcity.
5. **Day 3 drop-off >60%**: Final offer not compelling. Strengthen incentive.

---

### Tab 4: A/B Tests (🧪 Experiment Results)

**What You See**:
- Table of active tests (running now)
- Recent winners (tests completed with clear winner)
- Historical success rate (% of tests that found winners)
- Upcoming tests (next tests scheduled)

**How to Read Results**:

```
Active Test: "Day 0 Subject Line - Week of May 26"
Duration: 7 days | Sample: 2,500 | p-value: 0.035 | Status: IN PROGRESS ⏳

p-value 0.035 means: 96.5% confidence difference is NOT random
✓ 96.5% > 95% threshold = WINNING TEST
```

**Winners Board**:

```
Test                      | Winner      | Confidence | Deployed?
─────────────────────────┼─────────────┼────────────┼───────────
Day 0 Subject Line #3    | Variant B   | 96.5%      | ✓ Live
Day 1 CTA Button Text    | Variant A   | 94.2%      | ✓ Live
Day 0 Time to Send       | Variant B   | 92.1%      | ⏳ Pending
```

**What "p-value" Means**:
- 0.050 = 95.0% confidence (minimum acceptable)
- 0.035 = 96.5% confidence (good)
- 0.010 = 99.0% confidence (very high)
- 0.100+ = Not statistically significant (run longer)

**Quick Actions**:
- Watch test progress in "Active Tests" section
- Deploy winner immediately when p-value <0.05
- Run multivariate test on elements that won:
  - Subject line (Day 0)
  - CTA button text (Day 1)
  - Offer wording (Day 2)
  - Urgency copy (Day 3)

**Pro Tips**:
1. Don't stop test early (even if winning) - gives more data
2. Typical test needs 2,000+ samples for statistical power
3. Test 1 element at a time (not multiple at once)
4. Winning variants usually lift metrics 2-5%
5. Apply winners immediately to all new sequences

---

### Tab 5: Channel Mix (📱 SMS vs Kakao vs Email)

**What You See**:
- Comparison table (SMS, Kakao, Email side-by-side)
- Dual-axis chart (Open rate vs Cost per message)
- Recommendation engine (suggested allocation)
- Spend breakdown pie chart
- Optimal allocation bar chart

**How to Read Comparison**:

```
Channel | Sent  | Opened | Clicked | Cost/Msg | ROI    | Best For
────────┼───────┼────────┼─────────┼──────────┼────────┼──────────────
SMS     | 5,000 | 1,900  | 570     | ₩50      | 85%    | 💰 Cheapest
Kakao   | 3,000 | 1,500  | 450     | ₩30      | 120%   | 📈 Best ROI
Email   | 2,000 | 400    | 80      | ₩100     | 15%    | ❌ Avoid
```

**What ROI Means**:
- SMS: 85% = For every ₩1 spent, get ₩1.85 back
- Kakao: 120% = For every ₩1 spent, get ₩2.20 back ✓ Best
- Email: 15% = For every ₩1 spent, get ₩1.15 back

**Chart Interpretation** (Dual-Axis):
```
Left Y-axis:  Open Rate (line)    → Higher = Better engagement
Right Y-axis: Cost/Message (bar)  → Lower = Better ROI

  Open Rate: Kakao (50%) > SMS (38%) > Email (20%)
  Cost:      Kakao (₩30) < SMS (₩50) < Email (₩100)

  VERDICT: Kakao wins on both counts!
```

**Current vs Optimal Spend**:

```
Current Allocation:
[===============    ] SMS    50%
[===========        ] Kakao  35%
[====               ] Email  15%

Recommended:
[===========        ] SMS    35%  (←down 15%)
[===================] Kakao  45%  (←up 10%)
[====               ] Email  20%  (↑up 5%)

Expected Result: +$45K monthly revenue
```

**Quick Actions**:
- **Increase Kakao by 20%**: Expected +$45K/month
- **Reduce Email**: Poor ROI, reallocate budget
- **Test SMS timing**: Cheaper, but lower engagement
- **Read recommendation**: Follow suggestion for next month

**Pro Tips**:
1. Kakao usually has 30-40% higher open rate than SMS
2. Email is good for long-form content, poor for urgency
3. SMS is cheapest (50₩) - use for mass broadcasts
4. Kakao (30₩) - best for engagement (use first)
5. Optimal mix: Kakao 40-50% + SMS 30-40% + Email 10-20%

---

## Metrics Glossary

### Key Metrics

| Metric | Formula | Good Range | Action If Bad |
|--------|---------|------------|---------------|
| **Conversion Rate** | Conversions / Sequences | 15-25% | Test different psychology lenses |
| **Open Rate** | Opened / Sent | 30-40% | Test subject lines/timing |
| **Click Rate** | Clicked / Sent | 8-15% | Strengthen CTA |
| **LTV** | Total Revenue / Conversions | ₩500K+ | Upsell/cross-sell |
| **CPA** | Total Cost / New Customers | <5% of LTV | Optimize channels |
| **ROI** | (Revenue - Cost) / Cost | 100%+ | Reduce spend or increase rev |
| **ROAS** | Revenue / Cost | 200%+ | Reduce spend or increase rev |
| **Trend** | vs Baseline (basis points) | +50 or better | Growing faster than average |

### Psychology Lens Success Rates

| Lens | Typical Conversion | Revenue/Contact |
|------|-------------------|-----------------|
| L10 (Immediate Decision) | 40-50% | ₩1M+ |
| L6 (Timing/Loss Aversion) | 25-35% | ₩800K |
| L9 (Health/Safety) | 20-30% | ₩600K |
| L7 (Companion Persuasion) | 15-25% | ₩500K |
| L5 (Self-Projection) | 10-20% | ₩400K |
| L3 (Differentiation) | 10-20% | ₩400K |
| L8 (Repurchase/Habit) | 8-18% | ₩350K |
| L2 (Preparation) | 5-15% | ₩250K |
| L4 (Feature Complexity) | 5-12% | ₩200K |
| L1 (Price Objection) | 3-10% | ₩150K |
| L0 (Inactive) | 2-8% | ₩100K |

---

## Daily Workflow

### Morning (5 minutes)

1. Open Performance Dashboard
2. Check **Overview** tab
   - Revenue trending up or down?
   - Conversion rate stable?
   - Active sequences enough?
3. Check **A/B Tests** tab
   - Any new winners (p-value < 0.05)?
   - Deploy winners to production
4. Click "Export Report" for your team meeting

### Weekly (15 minutes)

1. Review **Lens Analytics** tab
   - Which lens is growing fastest?
   - Which lens has lowest conversion?
2. Review **Day 0-3 Analytics** tab
   - Any sequences with drop-off >60%?
   - Plan sequence improvements for next week
3. Review **Channel Mix** tab
   - Rebalance budget if ROI changed >10%

### Monthly (30 minutes)

1. Export full report (30-day)
2. Review all 5 tabs for trends
3. Plan next month's tests
4. Identify growth opportunities (L6 → +10%)

---

## Troubleshooting

### "No Data Shows in Dashboard"

**Cause**: Sequences not deployed yet (TASK 2)  
**Fix**: 
1. Go to **CRM** → **Day 0-3 Settings**
2. Create sequence template
3. Deploy to contact segment
4. Wait 24 hours for data to appear

### "Conversion Rate Looks Too High"

**Cause**: Test data or manual flag  
**Check**:
1. Look at absolute numbers (# converted)
2. Is it reasonable? (Conversion usually 5-25%)
3. Contact your admin if suspicious

### "Metrics Don't Match Our Records"

**Note**: Dashboard uses nearest 10K rounded (for performance)  
**Exact numbers**: See daily CSV export  
**Timing**: Data updates nightly (UTC 0:00)

### "Can't See A/B Test Results"

**Check**:
1. Test must have >500 samples (running)
2. Test must be >7 days old (statistical power)
3. Email team if test is stuck >14 days

### "Export Button Not Working"

**Solution**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Try different browser
3. Check that file doesn't block pop-ups
4. Contact support if still broken

---

## Quick Reference

### Copy-Paste Formulas for Your Spreadsheet

```
Revenue This Month =    Conversions × ₩100,000
Conversion Rate =       Conversions / Total Sequences × 100%
CPA =                   Total Cost / Conversions
LTV =                   Total Revenue / Conversions
ROI =                   (Revenue - Cost) / Cost × 100%
ROAS =                  Revenue / Cost × 100%
Expected Monthly Rev =  Daily Revenue × 30 days
```

### One-Sentence Summary per Tab

- **Overview**: "How much $ did we make and how healthy is the funnel?"
- **Lens**: "Which customer psychology segments are converting best?"
- **Day 0-3**: "Are our SMS sequences engaging customers?"
- **A/B Tests**: "Which message variations are winning?"
- **Channels**: "SMS or Kakao - which gives better ROI?"

---

## Next Steps

1. ✅ Bookmark this page: `/analytics/performance`
2. ✅ Check dashboard daily (2 minutes)
3. ✅ Review weekly (15 minutes)
4. ✅ Act on insights (deploy winners, adjust budget)
5. ✅ Share reports with team (monthly)

---

## Support

- **Questions about metrics?** Email: support@mabiz.com
- **Bug report?** Click "Report Issue" in dashboard
- **Feature request?** Post in #analytics channel on Slack

---

**Last Updated**: 2026-05-27  
**Version**: 1.0
