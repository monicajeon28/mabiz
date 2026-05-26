# Analytics API Reference

**Version**: 1.0  
**Base URL**: `/api/analytics`  
**Authentication**: Required (RBAC - GLOBAL_ADMIN | OWNER | AGENT)

## Table of Contents

1. [GET /analytics/performance](#1-get-analyticsperformance) - Main dashboard endpoint
2. [GET /analytics/performance/lens](#2-get-analyticsperformancelens) - Lens details
3. [GET /analytics/performance/report](#3-get-analyticsperformancereport) - Full report
4. [GET /analytics/performance/export](#4-get-analyticsperformanceexport) - CSV export
5. [Error Handling](#5-error-handling)
6. [Rate Limiting](#6-rate-limiting)
7. [Examples](#7-examples)

---

## 1. GET /analytics/performance

**Main unified dashboard endpoint**

### Request

```http
GET /api/analytics/performance?dateRange=30
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dateRange` | '7' \| '14' \| '30' \| '90' | '30' | Number of days to include |

### Response

**Status**: 200 OK

```json
{
  "ok": true,
  "overview": {
    "totalRevenue": 3000000,
    "lastMonthRevenue": 2500000,
    "conversionRate": 0.15,
    "lastMonthConversionRate": 0.12,
    "activeSequences": 145,
    "avgOpenRate": 0.38,
    "cpa": 5000,
    "ltv": 666667
  },
  "dailyData": [
    {
      "date": "2026-05-26",
      "revenue": 100000,
      "conversions": 1,
      "sent": 250,
      "opened": 95,
      "clicked": 28
    }
    // ... 29 more days
  ],
  "lensData": [
    {
      "lens": "L6",
      "count": 125,
      "conversionRate": 0.25,
      "ltv": 800000,
      "monthlyRevenue": 2000000,
      "trend": 150
    }
    // ... L0-L10 (11 total)
  ],
  "day03Data": [
    {
      "day": 0,
      "sentCount": 1000,
      "openRate": 0.40,
      "clickRate": 0.12,
      "conversionRate": 0.06,
      "stage": "P+A (Problem/Agitate)"
    }
    // ... Days 1-3
  ],
  "sequenceData": [
    {
      "id": "seq_abc123",
      "name": "DAY0 Sequence #1",
      "deployed": "2026-05-25",
      "sent": 1,
      "opened": 1,
      "clicked": 1,
      "converted": 0,
      "status": "ACTIVE"
    }
    // ... up to 50 sequences
  ],
  "testData": [
    {
      "id": "test_def456",
      "name": "Day 0 Subject Line Test",
      "duration": "7 days",
      "sampleSize": 2500,
      "pValue": 0.035,
      "winner": "Variant B",
      "status": "CONCLUDED"
    }
    // ... up to 20 tests
  ],
  "channelData": [
    {
      "channel": "SMS",
      "sent": 5000,
      "opened": 1900,
      "clicked": 570,
      "costPerMessage": 50,
      "roi": 0.85
    },
    {
      "channel": "KAKAO",
      "sent": 3000,
      "opened": 1500,
      "clicked": 450,
      "costPerMessage": 30,
      "roi": 1.20
    },
    {
      "channel": "EMAIL",
      "sent": 2000,
      "opened": 400,
      "clicked": 80,
      "costPerMessage": 100,
      "roi": 0.15
    }
  ]
}
```

**Response Time**: 1-3 seconds (first request) or <500ms (cached)

### Field Descriptions

#### Overview Object

| Field | Type | Description |
|-------|------|-------------|
| `totalRevenue` | number | Revenue from conversions this month (₩) |
| `lastMonthRevenue` | number | Revenue from last month (₩) |
| `conversionRate` | number | Decimal (0-1), e.g., 0.15 = 15% |
| `lastMonthConversionRate` | number | Previous month's conversion rate |
| `activeSequences` | number | Count of ongoing Day 0-3 sequences |
| `avgOpenRate` | number | Blended open rate across all channels |
| `cpa` | number | Cost per acquisition (₩) |
| `ltv` | number | Average lifetime value per customer (₩) |

#### Daily Data Array

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | ISO format YYYY-MM-DD |
| `revenue` | number | Daily revenue (₩) |
| `conversions` | number | Count of conversions |
| `sent` | number | SMS/messages sent |
| `opened` | number | Messages opened |
| `clicked` | number | Messages clicked |

#### Lens Data Array

| Field | Type | Description |
|-------|------|-------------|
| `lens` | string | "L0" to "L10" (psychology lens) |
| `count` | number | Contacts classified with this lens |
| `conversionRate` | number | Decimal (0-1) |
| `ltv` | number | Average revenue per customer (₩) |
| `monthlyRevenue` | number | Total monthly revenue (₩) |
| `trend` | number | Basis points vs average (e.g., 150 = +1.5%) |

#### Day 0-3 Data Array

| Field | Type | Description |
|-------|------|-------------|
| `day` | number | 0, 1, 2, or 3 |
| `sentCount` | number | Messages sent on this day |
| `openRate` | number | Decimal (0-1) |
| `clickRate` | number | Decimal (0-1) |
| `conversionRate` | number | Decimal (0-1) |
| `stage` | string | PASONA stage (P+A, S, O+N, A) |

#### Sequence Data Array

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique sequence ID |
| `name` | string | Human-readable name |
| `deployed` | string | YYYY-MM-DD deployment date |
| `sent` | number | Sequences sent (0 or 1) |
| `opened` | number | Sequences opened |
| `clicked` | number | Sequences clicked |
| `converted` | number | Sequences with conversion |
| `status` | string | "ACTIVE" \| "COMPLETED" \| "PAUSED" |

#### Test Data Array

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Test ID |
| `name` | string | Test name |
| `duration` | string | e.g., "7 days" |
| `sampleSize` | number | Total samples (A+B) |
| `pValue` | number | Statistical significance (0-1) |
| `winner` | string \| null | "Variant A" \| "Variant B" \| null |
| `status` | string | "IN PROGRESS" \| "CONCLUDED" \| "FAILED" |

#### Channel Data Array

| Field | Type | Description |
|-------|------|-------------|
| `channel` | string | "SMS" \| "KAKAO" \| "EMAIL" |
| `sent` | number | Total sent |
| `opened` | number | Total opened |
| `clicked` | number | Total clicked |
| `costPerMessage` | number | Cost in ₩ |
| `roi` | number | Decimal, -1 = -100%, 1 = +100% |

### Errors

| Code | Description |
|------|-------------|
| 401 | Unauthorized (missing/invalid auth) |
| 400 | No organization found |
| 500 | Internal server error |

---

## 2. GET /analytics/performance/lens

**Detailed lens analytics**

### Request

```http
GET /api/analytics/performance/lens?days=30&lens=L6
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 30 | Number of past days |
| `lens` | string | - | Optional: filter to specific lens (e.g., "L6") |

### Response

```json
{
  "ok": true,
  "data": [
    {
      "lens": "L6",
      "contactCount": 125,
      "conversionRate": 0.25,
      "conversionCount": 31,
      "ltv": 800000,
      "monthlyRevenue": 2000000,
      "trend": 150,
      "topSequence": "seq_abc123"
    }
  ],
  "summary": {
    "totalLenses": 11,
    "activeLenses": 8,
    "topLens": {
      "lens": "L6",
      "monthlyRevenue": 2000000
    }
  }
}
```

### Response Structure

Each lens object includes:

| Field | Type | Description |
|-------|------|-------------|
| `lens` | string | L0-L10 |
| `contactCount` | number | Contacts classified |
| `conversionRate` | number | Decimal (0-1) |
| `conversionCount` | number | Count of conversions |
| `ltv` | number | Life time value (₩) |
| `monthlyRevenue` | number | Total revenue (₩) |
| `trend` | number | Basis points vs baseline |
| `topSequence` | string | Best performing sequence ID |

---

## 3. GET /analytics/performance/report

**Generate comprehensive performance report**

### Request

```http
GET /api/analytics/performance/report?days=30&format=json
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 30 | Report period in days |
| `format` | 'json' \| 'pdf' | 'json' | Output format |

### Response

```json
{
  "ok": true,
  "data": {
    "period": {
      "startDate": "2026-04-27",
      "endDate": "2026-05-27",
      "days": 30
    },
    "overview": {
      "totalRevenue": 3000000,
      "totalContacts": 500,
      "conversionRate": 0.15,
      "avgOrderValue": 666667,
      "ltv": 750000,
      "cpa": 5000
    },
    "topLenses": [
      {
        "lens": "L6",
        "contactCount": 125,
        "conversionRate": 0.25,
        "ltv": 800000,
        "monthlyRevenue": 2000000,
        "trend": 150
      }
      // ... up to 5 lenses
    ],
    "day03Performance": [
      {
        "day": 0,
        "sent": 1000,
        "opened": 400,
        "clicked": 120,
        "converted": 60,
        "openRate": 0.40,
        "clickRate": 0.12,
        "conversionRate": 0.06,
        "stage": "P+A (Problem/Agitate)"
      }
      // ... Days 1-3
    ],
    "channelPerformance": [
      {
        "channel": "SMS",
        "sent": 5000,
        "opened": 1900,
        "clicked": 570,
        "costPerMessage": 50,
        "totalCost": 250000,
        "roi": 0.85,
        "roas": 1.85
      }
      // ... Kakao, Email
    ],
    "recommendations": [
      "Focus on L6: Contributing 2M KRW/month. If grown 10%, expect +200K KRW additional revenue.",
      "SMS has highest ROI (185%). Consider increasing allocation by 20% next month.",
      "Day 0 open rate (40%) below benchmark (35%). Test subject line variants."
    ],
    "timestamp": "2026-05-27T10:30:00Z"
  }
}
```

---

## 4. GET /analytics/performance/export

**Export analytics data as CSV**

### Request

```http
GET /api/analytics/performance/export?dateRange=30&format=csv
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dateRange` | '7' \| '14' \| '30' \| '90' | '30' | Period |
| `format` | 'csv' | 'csv' | Export format |

### Response

**Status**: 200 OK  
**Content-Type**: `text/csv; charset=utf-8`  
**Content-Disposition**: `attachment; filename="performance-report-2026-05-27.csv"`

**CSV Format**:

```csv
마비즈 CRM - 성과 리포트
기간: 2026-04-27 ~ 2026-05-27 (30일)

=== 개요 ===
총 수익,3000000 KRW
총 고객수,500
전환율,15.00%
평균 주문가,666667 KRW
LTV,750000 KRW
CPA,5000 KRW

=== 상위 렌즈 ===
렌즈,고객수,전환율,LTV,월수익,추이
L6,125,25.00%,800000 KRW,2000000 KRW,+150 bps
...

=== Day 0-3 성과 ===
Day,발송,오픈,클릭,전환,오픈율,클릭율,전환율
Day0,1000,400,120,60,40.00%,12.00%,6.00%
...

=== 채널별 성과 ===
채널,발송,오픈,클릭,메시지당비용,총비용,ROI,ROAS
SMS,5000,1900,570,50₩,250000₩,85.00%,185.00%
...

=== 권장사항 ===
- Focus on L6...
- SMS has highest ROI...
- Day 0 open rate...

생성시간: 2026-05-27T10:30:00Z
```

---

## 5. Error Handling

### Standard Error Response

```json
{
  "ok": false,
  "error": "Error message describing what went wrong"
}
```

### Common Errors

**401 Unauthorized**
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

**400 Bad Request**
```json
{
  "ok": false,
  "error": "No organization found"
}
```

**500 Internal Server Error**
```json
{
  "ok": false,
  "error": "Internal server error"
}
```

---

## 6. Rate Limiting

**Current Limits** (per organization):
- 100 requests/hour for main endpoint
- 50 requests/hour for export endpoint
- 10 requests/minute for report generation

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 2026-05-27T11:30:00Z
```

**429 Too Many Requests**:
```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfter": 300
}
```

---

## 7. Examples

### Example 1: Get 7-Day Performance

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://api.mabiz.com/api/analytics/performance?dateRange=7"
```

### Example 2: Get L6 Lens Details

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://api.mabiz.com/api/analytics/performance/lens?days=30&lens=L6"
```

### Example 3: Download 30-Day Report as CSV

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://api.mabiz.com/api/analytics/performance/export?dateRange=30&format=csv" \
  -o performance-report.csv
```

### Example 4: JavaScript/TypeScript Client

```typescript
import fetch from 'node-fetch';

interface PerformanceData {
  ok: boolean;
  overview: {
    totalRevenue: number;
    conversionRate: number;
    // ... other fields
  };
  dailyData: Array<{ date: string; revenue: number }>;
  // ... other arrays
}

async function getPerformanceData(dateRange: '7' | '14' | '30' | '90' = '30') {
  const response = await fetch(
    `/api/analytics/performance?dateRange=${dateRange}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data: PerformanceData = await response.json();
  
  console.log(`Total Revenue: ₩${data.overview.totalRevenue.toLocaleString('ko-KR')}`);
  console.log(`Conversion Rate: ${(data.overview.conversionRate * 100).toFixed(2)}%`);
  
  return data;
}

// Usage
const data = await getPerformanceData('30');
```

### Example 5: React Component (SWR)

```typescript
import useSWR from 'swr';

export function PerformanceDashboard() {
  const { data, isLoading, error } = useSWR(
    '/api/analytics/performance?dateRange=30',
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Total Revenue: ₩{data.overview.totalRevenue.toLocaleString('ko-KR')}</h1>
      <p>Conversion Rate: {(data.overview.conversionRate * 100).toFixed(2)}%</p>
    </div>
  );
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-27 | Initial release - 4 endpoints |
| TBD | 2026-06-XX | Drill-down support (lens → contacts) |
| TBD | 2026-06-XX | PDF export support |
| TBD | 2026-06-XX | Custom date range picker |
