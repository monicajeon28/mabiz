# SMS A/B Test Analysis - Quick Start Guide

**For**: Team members who need to use the A/B test system  
**Time to read**: 5 minutes  
**Video demo**: [Link to come]

---

## TL;DR

1. Go to **SMS Logs** → **A/B 테스트 분석** tab
2. Select a test from dropdown
3. Review the comparison table (p-value, open rate, click rate, conversion rate)
4. Read the recommendation
5. Deploy the winner variant

---

## Step-by-Step: How to Use the Dashboard

### Step 1: Navigate to the Dashboard
```
Location: Dashboard → SMS Logs → "A/B 테스트 분석" tab
```

### Step 2: Select a Test
```
Dropdown shows all active and completed tests
Format: "Test Name (OBJECTIVE_TYPE)"
Example: "Day 0 Scarcity vs Urgency (CONVERSION)"
```

### Step 3: Read the Results Table

**Key Metrics** (A vs B):

| Metric | What It Means | Good | Bad |
|--------|---------------|------|-----|
| **발송수** | Total SMS sent to variant | Higher = more data | < 100 = continue testing |
| **오픈율** | % who opened SMS | Higher = better | < 20% = poor quality |
| **클릭율** | % who clicked link | Higher = better | < 5% = poor quality |
| **전환율** | % who purchased | Higher = GOAL | This is primary metric |
| **응답율** | % who responded | Higher = engagement | Context-dependent |

**Color Coding**:
- 🟢 Green difference = Variant B wins on this metric
- 🔴 Red difference = Variant A wins on this metric

### Step 4: Check Statistical Significance

**Look for**: **p-value** in top-right corner

```
p-value < 0.05 (SIGNIFICANT)
  → Result is likely real, not luck
  → Safe to deploy winner
  → 95% confidence

p-value > 0.05 (NOT SIGNIFICANT)
  → Result could be luck
  → Continue testing
  → More samples needed
```

**Example**:
- p = 0.023 → SIGNIFICANT ✅ Deploy
- p = 0.18 → NOT SIGNIFICANT ⏳ Keep testing
- p = 0.001 → HIGHLY SIGNIFICANT ✅✅ Deploy confidently

### Step 5: Check Other Statistics

**Relative Risk (RR)**:
- RR = 1.53 → Variant B is **53% better** than A
- RR = 0.85 → Variant A is **15% better** than B

**Odds Ratio (OR)**:
- Similar to RR, more intuitive for rare events
- Generally interpret same way

**95% Confidence Interval**:
- Shows range of likely true value
- If CI doesn't cross 0, likely significant
- If CI is wide, need more data

### Step 6: Read the Recommendation

**Dashboard generates smart recommendations**:

**If Significant & B Wins**:
```
✅ B is significantly better: 5.5% vs 3.6% (+53%, p=0.0230). Deploy B.
```
→ Action: Deploy Variant B immediately

**If Significant & A Wins**:
```
✅ A is significantly better: 4.2% vs 2.8% (+50%, p=0.0180). Deploy A.
```
→ Action: Keep Variant A, retire B

**If Not Significant But Trend**:
```
⚠️ B shows trend of improvement (5.5% vs 3.6%, p=0.18) but not significant. Continue testing.
```
→ Action: Run test longer, need ~300 more samples per variant

**If No Difference**:
```
➡️ No meaningful difference (p=0.67). Either variant works.
```
→ Action: Deploy either variant, consider other factors (cost, readability, etc.)

### Step 7: View Variant Templates

**Scroll down** to see Variant A and B templates side-by-side:
- Variant A: Original (baseline) message
- Variant B: New message being tested

Use this to understand WHY one performed better.

---

## Common Questions

### Q1: "What does 'p < 0.05' mean?"
**A**: There's less than 5% chance the difference happened by luck. So we're >95% confident the difference is real.

**Analogy**: Flipping a coin 1,000 times and getting 600 heads. That would only happen by luck 1 in 10 billion times, so we're confident the coin is weighted.

### Q2: "When should I stop testing?"
**A**: When:
- p-value < 0.05 (statistically significant), OR
- Sample size > 500 per variant AND p > 0.05 (no difference detected)

Don't stop early unless p < 0.001 (very strong evidence).

### Q3: "Sample size is only 45. Is that enough?"
**A**: No. Generally need 100+ per variant. Recommendation will tell you: "Continue testing. Need 55 more samples for A."

### Q4: "Variant A is 3.6% and B is 3.7%. Why no clear winner?"
**A**: 0.1 percentage point difference is tiny. You'd need 10,000+ samples to detect something so small. For practical purposes, they're the same.

### Q5: "Why is the recommendation different from what I think?"
**A**: The dashboard uses statistics, not gut feel. Trust the math. If p < 0.05, the data says one variant is better.

### Q6: "Can I test more than 2 variants at once?"
**A**: Currently, this system tests A vs B (binary). Multi-variant testing coming in v2. For now, run sequential tests: A vs B, then B vs C, etc.

---

## Real-World Example

### Test: "Day 0 Scarcity vs Urgency"

**Setup**:
- Variant A: "렌탈 선착순 20개 한정!" (Scarcity)
- Variant B: "오늘 예약하면 10% 할인 (자정까지)" (Urgency)
- Duration: 7 days
- Both variants sent 500 SMS each

**Results Dashboard Shows**:
```
A vs B 비교:
                    A(기존)      B(신규)      차이
발송수             500         510        +10
오픈율            30.0%       33.3%      +3.3pp
클릭율             9.0%        13.3%      +4.3pp
전환율 [KEY]       3.6%        5.5%      +1.9pp

Statistical Test:
χ² = 5.15, z = 2.27, p = 0.023 ✓ SIGNIFICANT
95% CI: [0.8%, 3.8%] difference
Relative Risk: 1.53x (B is 53% better!)

권장사항:
✅ B is significantly better: 5.5% vs 3.6% (+53%, p=0.0230). Deploy B.
```

**Interpretation**:
- Urgency worked 53% better than scarcity
- We're 97.7% confident (p = 0.023)
- Deploy Variant B for Day 0

**Impact**:
- Monthly SMS volume: 50,000
- Additional conversions: 50,000 × 1.9% = 950 conversions
- Revenue gain: 950 × $580 = **$551,000/month**

---

## Key Metrics Definitions

### Conversion Rate (Most Important)
- **What**: % of people who completed goal (purchase, sign-up, etc.)
- **Formula**: Conversions ÷ Total Sent
- **Example**: 28 conversions ÷ 510 sent = 5.5%
- **Why**: Direct link to business value

### Open Rate
- **What**: % of SMS opened (if tracked)
- **Formula**: Opened ÷ Total Sent
- **Note**: Harder to track for SMS vs email

### Click Rate
- **What**: % who clicked link in SMS
- **Formula**: Clicked ÷ Total Sent
- **Purpose**: Engagement metric

### Response Rate
- **What**: % who replied to SMS
- **Formula**: Responded ÷ Total Sent
- **Purpose**: Engagement/interest indicator

### Relative Risk (RR)
- **What**: How many times better variant B is than A
- **Formula**: Rate_B ÷ Rate_A
- **Example**: 5.5% ÷ 3.6% = 1.53x
- **Meaning**: B is 53% better (1.53 - 1.0 = 0.53 = 53%)

### p-value
- **What**: Probability difference happened by random luck
- **Range**: 0 to 1 (0% to 100%)
- **Threshold**: < 0.05 is "significant"
- **Intuition**: Lower = more confident

---

## Troubleshooting

### "Test not showing up in dropdown"
**Possible causes**:
1. Test is for different organization
2. Test status is DRAFT (not ACTIVE)
3. No data collected yet

**Solution**: Contact analytics team

### "Recommendation seems wrong"
**Remember**:
1. Dashboard uses statistics, not intuition
2. If p < 0.05, data supports the recommendation
3. Sample size matters (need 100+ per variant)

**Solution**: Review sample size first

### "Numbers look different in CSV vs dashboard"
**Reasons**:
1. Dashboard uses real-time data
2. CSV may be cached
3. Time zone differences

**Solution**: Refresh dashboard or clear cache

### "All metrics favor B, but p-value is high?"
**Reason**: Differences are too small to be statistically significant with current sample size

**Solution**: Continue test longer to reach 100+ samples per variant

---

## Best Practices

### DO's ✅
- Pre-register hypothesis before test ("We expect B to be 30% better")
- Test ONE element per test (copy, timing, or design - not all three)
- Run test for at least 7 days (captures day-of-week effects)
- Use psychology frameworks (L0, L1, L6, L10, etc.)
- Wait for p < 0.05 before declaring winner

### DON'Ts ❌
- Don't stop test early just because p-value looks good (p-hacking)
- Don't run with < 100 samples per variant (not enough data)
- Don't mix customer segments (L0 vs L6 behave differently)
- Don't change variant during test (breaks randomization)
- Don't test multiple things at once (can't tell what worked)

---

## Need Help?

**For usage questions**: See this guide or ask in #crm-analytics

**For weird results**: Contact [Analytics Team]

**For feature requests**: Open GitHub issue or ask product team

**For technical details**: Read `docs/SMS_AB_TEST_SYSTEM.md`

---

**Quick Start Version**: 1.0  
**Last Updated**: 2026-05-27  
**Questions?** → #crm-analytics Slack channel
