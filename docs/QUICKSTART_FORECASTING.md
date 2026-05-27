# Quick Start: Predictive Revenue Forecasting

## 5-Minute Setup

### 1. Basic Revenue Forecast

```bash
# Get 30-day revenue forecast
curl -X GET "http://localhost:3000/api/forecast/revenue?days=30" \
  -H "x-organization-id: org_123"
```

**Response**:
```json
{
  "daily": [
    {
      "date": "2026-05-28",
      "revenue": 85000,
      "lower90": 68000,
      "upper90": 102000,
      "confidence": 0.92
    },
    // ... 29 more days
  ],
  "summary": {
    "total30Day": 2550000,
    "avg30Day": 85000,
    "expectedGrowth": 5.0
  }
}
```

### 2. Check Conversion Forecast

```bash
# Predict conversion rate for next 30 days
curl -X GET "http://localhost:3000/api/forecast/conversion?period=30" \
  -H "x-organization-id: org_123"
```

**Response**:
```json
{
  "overall": {
    "current": 5.2,
    "forecast7Day": 5.5,
    "forecast30Day": 6.1,
    "changePercent": 17.3,
    "trend": "UP"
  },
  "byChannel": {
    "sms": { "current": 5.5, "forecast7Day": 5.9, "forecast30Day": 6.5 },
    "kakao": { "current": 6.2, "forecast7Day": 6.6, "forecast30Day": 7.2 },
    "email": { "current": 3.8, "forecast7Day": 4.0, "forecast30Day": 4.3 }
  }
}
```

### 3. Run "What-If" Scenario

```bash
# Predict impact of increasing SMS volume by 20%
curl -X POST "http://localhost:3000/api/forecast/scenario" \
  -H "x-organization-id: org_123" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      {
        "type": "sms_volume_increase",
        "value": 20,
        "description": "Increase SMS volume by 20%"
      }
    ]
  }'
```

**Response**:
```json
{
  "analysis": {
    "revenue7DayDelta": 12500,
    "revenue30DayDelta": 56000,
    "percentChange30Day": 15.2,
    "roi": 325,
    "paybackPeriodDays": 3,
    "recommendation": "Strong growth (+15.2%) with 3-day payback. Recommended."
  }
}
```

### 4. Detect Anomalies

```bash
# Check for unusual performance in last 7 days
curl -X GET "http://localhost:3000/api/forecast/anomalies?lookback=7" \
  -H "x-organization-id: org_123"
```

**Response**:
```json
{
  "summary": {
    "totalAnomalies": 2,
    "positiveCount": 1,
    "negativeCount": 1,
    "criticalCount": 0
  },
  "anomalies": [
    {
      "date": "2026-05-28",
      "actual": 125000,
      "forecast": 85000,
      "deviation": 47.1,
      "type": "POSITIVE",
      "rootCauses": [
        {
          "factor": "Partner Spike - PartnerId123",
          "impact": 35.0,
          "evidence": "25 partner sales detected"
        }
      ],
      "recommendations": [
        "Great performance! Consider scaling partner programs."
      ]
    }
  ],
  "actionItems": [
    {
      "priority": "HIGH",
      "type": "REPLICATE",
      "title": "Replicate: Partner Sales Spike",
      "estimatedImpact": 40000
    }
  ]
}
```

---

## Common Use Cases

### Use Case 1: Budget Planning

**Goal**: Determine if revenue will hit $100K in 30 days

**Steps**:
1. Get 30-day forecast: `GET /api/forecast/revenue?days=30`
2. Check summary: `total30Day` ≈ $2.55M → $85K/day average
3. Compare to goal: On track ✅

**Action**: Budget can be allocated based on forecast revenue

### Use Case 2: Launch Decision

**Goal**: Decide whether to launch new SMS sequence

**Steps**:
1. Run scenario: `POST /api/forecast/scenario`
   - type: `new_sequence`
   - value: 15 (15% conversion lift expected)

2. Analyze results:
   - ROI: 325%
   - Payback: 3 days
   - Risk: MEDIUM

3. Decision: **Launch** (strong ROI, quick payback)

**Action**: Implement new sequence

### Use Case 3: Investigate Performance Drop

**Goal**: Understand why revenue is below forecast

**Steps**:
1. Get anomalies: `GET /api/forecast/anomalies?lookback=7`
2. Review actionItems with type: "INVESTIGATE"
3. Check rootCauses for explanation
4. Take corrective action based on evidence

**Example**:
```
Root Cause: SMS open rate dropped 5%
Action: Review message content, test new templates
Expected Impact: +2% conversion recovery
```

### Use Case 4: Partner Network Optimization

**Goal**: Impact of increasing partner commission

**Steps**:
1. Run scenario: `POST /api/forecast/scenario`
   - type: `partner_commission`
   - value: 5 (increase commission by 5%)

2. Compare scenarios:
   - ROI: 180%
   - 30-day delta: $35K
   - Payback: 5 days

3. Decision: **Implement** (positive ROI but monitor)

**Action**: Update partner rates, monitor conversion

### Use Case 5: Channel Optimization

**Goal**: Understand relative channel performance

**Steps**:
1. Get conversion forecast: `GET /api/forecast/conversion?period=30`
2. Review byChannel metrics
3. Compare forecasted conversion rates:
   - SMS: 5.5% → 6.5% (trend: UP)
   - Kakao: 6.2% → 7.2% (trend: UP)
   - Email: 3.8% → 4.3% (trend: STABLE)

**Action**: 
- Increase SMS allocation (highest lift)
- Monitor Kakao (outperforming)
- Consider email optimization

---

## API Examples in Code

### TypeScript/JavaScript

```typescript
// Revenue Forecast
async function getRevenueForecasts(orgId: string, days: number = 30) {
  const response = await fetch(
    `/api/forecast/revenue?days=${days}`,
    {
      headers: { 'x-organization-id': orgId }
    }
  );
  
  const forecast = await response.json();
  
  // Use in UI
  return {
    next7Days: forecast.daily.slice(0, 7),
    next30Days: forecast.daily.slice(0, 30),
    summary: forecast.summary,
    trend: forecast.metadata.trendDirection
  };
}

// Conversion Forecast
async function getConversionForecasts(orgId: string) {
  const response = await fetch(
    `/api/forecast/conversion?period=30`,
    {
      headers: { 'x-organization-id': orgId }
    }
  );
  
  const forecast = await response.json();
  
  return {
    overall: forecast.overall,
    byChannel: forecast.byChannel,
    trends: forecast.byLens.map(lens => ({
      lens: lens.lens,
      current: lens.current,
      forecast: lens.forecast30Day
    }))
  };
}

// Scenario Planning
async function runScenario(
  orgId: string,
  scenarioName: string,
  changes: ScenarioChange[]
) {
  const response = await fetch('/api/forecast/scenario', {
    method: 'POST',
    headers: {
      'x-organization-id': orgId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ changes })
  });
  
  const result = await response.json();
  
  return {
    scenario: scenarioName,
    impact7Day: result.analysis.revenue7DayDelta,
    impact30Day: result.analysis.revenue30DayDelta,
    roi: result.analysis.roi,
    payback: result.analysis.paybackPeriodDays,
    recommendation: result.analysis.recommendation,
    riskLevel: result.analysis.riskLevel
  };
}

// Anomaly Detection
async function checkAnomalies(orgId: string, days: number = 7) {
  const response = await fetch(
    `/api/forecast/anomalies?lookback=${days}`,
    {
      headers: { 'x-organization-id': orgId }
    }
  );
  
  const report = await response.json();
  
  return {
    summary: report.summary,
    actionItems: report.actionItems.filter(
      item => item.priority === 'HIGH'
    ),
    rootCauses: report.topRootCauses
  };
}
```

### React Component

```tsx
import { useQuery } from '@tanstack/react-query';
import { Chart } from 'recharts';

export function ForecastDashboard({ orgId }) {
  // Fetch forecasts
  const { data: revenue } = useQuery(
    ['forecast', 'revenue'],
    () => fetch(`/api/forecast/revenue?days=30`, {
      headers: { 'x-organization-id': orgId }
    }).then(r => r.json())
  );
  
  const { data: conversion } = useQuery(
    ['forecast', 'conversion'],
    () => fetch(`/api/forecast/conversion?period=30`, {
      headers: { 'x-organization-id': orgId }
    }).then(r => r.json())
  );
  
  const { data: anomalies } = useQuery(
    ['forecast', 'anomalies'],
    () => fetch(`/api/forecast/anomalies?lookback=7`, {
      headers: { 'x-organization-id': orgId }
    }).then(r => r.json())
  );
  
  if (!revenue || !conversion) return <div>Loading...</div>;
  
  return (
    <div className="grid gap-4">
      {/* Revenue Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            30-Day Revenue Forecast: ${revenue.summary.total30Day.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Chart width={600} height={300} data={revenue.daily}>
            <XAxis dataKey="date" />
            <YAxis />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#8884d8" 
            />
            {/* Confidence bands */}
            <Area 
              type="monotone" 
              dataKey="lower90" 
              fill="#8884d8" 
              opacity={0.1} 
            />
            <Area 
              type="monotone" 
              dataKey="upper90" 
              fill="#8884d8" 
              opacity={0.1} 
            />
          </Chart>
        </CardContent>
      </Card>
      
      {/* Conversion Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            Conversion Forecast: {conversion.overall.forecast30Day.toFixed(2)}% 
            ({conversion.overall.trend})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">SMS</p>
              <p className="text-lg font-bold">
                {conversion.byChannel.sms.forecast30Day.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Kakao</p>
              <p className="text-lg font-bold">
                {conversion.byChannel.kakao.forecast30Day.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-lg font-bold">
                {conversion.byChannel.email.forecast30Day.toFixed(2)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Anomalies */}
      {anomalies?.actionItems.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">
              ⚠️ Action Items ({anomalies.actionItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {anomalies.actionItems.map(item => (
              <div key={item.title} className="mb-4 pb-4 border-b last:border-b-0">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-gray-600">{item.description}</p>
                <p className="text-sm mt-2">
                  Impact: <span className="font-bold">
                    ${Math.abs(item.estimatedImpact).toLocaleString()}
                  </span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Interpreting Results

### Revenue Forecast

| Metric | Interpretation |
|--------|-----------------|
| `revenue` | Most likely value (point estimate) |
| `lower90/upper90` | 90% confidence interval (range) |
| `lower95/upper95` | 95% confidence interval (wider range) |
| `confidence` | 0-1 score (0.85+ is good) |
| `trend` | Direction: UP/DOWN/STABLE |

**Example**: If forecast is $85K ± $17K (90% CI), there's 90% chance actual will be $68K-$102K

### Conversion Forecast

| Metric | Interpretation |
|--------|-----------------|
| `current` | Baseline conversion rate (%) |
| `forecast7Day` | Expected conversion in 7 days |
| `forecast30Day` | Expected conversion in 30 days |
| `changePercent` | % improvement vs current |
| `trend` | Direction of change |

**Example**: If current is 5.2% and forecast30Day is 6.1%, that's +0.9pp or +17.3% growth

### Anomaly Severity

| Severity | Deviation | Action |
|----------|-----------|--------|
| CRITICAL | > 50% | Escalate immediately |
| HIGH | 30-50% | Investigate within 24h |
| MEDIUM | 15-30% | Monitor and plan |
| LOW | < 15% | Normal variation |

---

## Tips & Tricks

### 1. Use Confidence Intervals for Planning
- Conservative budget: Use `lower95`
- Optimistic budget: Use `upper95`
- Most likely: Use `revenue`

### 2. Monitor Trends
- Check `metadata.trendDirection` weekly
- If trend changes from UP → DOWN, investigate
- Update partner targets based on trend

### 3. Scenario Combinations
- Test SMS + new sequence together
- Compare single vs combined impacts
- Identify synergies

### 4. Anomaly Root Causes
- Partner spikes are positive (celebrate!)
- SMS drops need investigation (fix asap)
- Weekly patterns are normal (expect them)

### 5. Channel Optimization
- Focus on fastest-growing channel
- Reduce investment in declining channels
- Test new messaging in high-volume channel

---

## FAQ

**Q: Why is forecast lower than I expected?**
- Check training data (< 60 days history → conservative)
- Look at recent trend (DOWN trend → lower forecast)
- Review anomalies (may indicate bias)

**Q: How accurate is the forecast?**
- 7-day: 85-95%
- 30-day: 75-85%
- 90-day: 60-75%
- More history → better accuracy

**Q: Why did forecast miss?**
- Check anomalies report (may show root cause)
- Review changes to business (campaigns, launches)
- Consider seasonality (holidays, weekends)

**Q: Can I adjust the forecast?**
- No manual adjustments (model-based forecasts are best practice)
- Instead, run scenarios to model expected changes
- Use anomalies to identify factors affecting forecast

**Q: How do I know if anomaly is real?**
- Check severity level (CRITICAL/HIGH are real)
- Review root causes (confidence score 0.7+)
- Look at evidence (transaction count, metrics)

---

## Support

For questions or issues:
1. Check troubleshooting section in full docs
2. Review API response for error details
3. Contact analytics team with forecast request

---

## Next Steps

- ✅ Try basic revenue forecast
- ✅ Check conversion trends by channel
- ✅ Run 2-3 scenarios for planning
- ✅ Monitor anomalies weekly
- ✅ Integrate forecast into dashboard
