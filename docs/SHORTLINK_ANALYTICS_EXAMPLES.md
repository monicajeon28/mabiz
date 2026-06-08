# ShortLink Analytics API - Usage Examples

## Example 1: Get Overall Performance (Dashboard)

### Request
```bash
curl -X GET \
  'http://localhost:3000/api/analytics/shortlink-performance?organizationId=org-mabiz-cruise&createdBy=user-john-doe&days=7' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Response (200 OK)
```json
{
  "ok": true,
  "data": {
    "total": {
      "clickCount": 127,
      "averageClicksPerDay": 18.14,
      "trend": "up"
    },
    "shortLinks": [
      {
        "id": "link-001",
        "code": "cruise-gold-50off",
        "title": "50% Off Gold Cruise Package",
        "targetUrl": "https://example.com/cruise/gold?promo=50off",
        "category": "promotion",
        "clickCount": 45,
        "lastClickedAt": "2026-06-06T15:30:22.000Z",
        "createdAt": "2026-06-01T10:00:00.000Z",
        "dailyClicks": [
          { "date": "2026-06-01", "clicks": 8 },
          { "date": "2026-06-02", "clicks": 6 },
          { "date": "2026-06-03", "clicks": 9 },
          { "date": "2026-06-04", "clicks": 7 },
          { "date": "2026-06-05", "clicks": 10 },
          { "date": "2026-06-06", "clicks": 5 }
        ]
      },
      {
        "id": "link-002",
        "code": "rental-summer-deals",
        "title": "Summer Rental Deals",
        "targetUrl": "https://example.com/rental/summer?utm_campaign=summer_2026",
        "category": "seasonal",
        "clickCount": 38,
        "lastClickedAt": "2026-06-06T14:15:10.000Z",
        "createdAt": "2026-05-15T08:30:00.000Z",
        "dailyClicks": [
          { "date": "2026-06-01", "clicks": 4 },
          { "date": "2026-06-02", "clicks": 5 },
          { "date": "2026-06-03", "clicks": 6 },
          { "date": "2026-06-04", "clicks": 8 },
          { "date": "2026-06-05", "clicks": 9 },
          { "date": "2026-06-06", "clicks": 6 }
        ]
      },
      {
        "id": "link-003",
        "code": "vip-member-exclusive",
        "title": "VIP Member Exclusive Access",
        "targetUrl": "https://example.com/vip/exclusive",
        "category": "member",
        "clickCount": 22,
        "lastClickedAt": "2026-06-05T11:45:00.000Z",
        "createdAt": "2026-05-20T14:20:00.000Z",
        "dailyClicks": [
          { "date": "2026-06-01", "clicks": 3 },
          { "date": "2026-06-02", "clicks": 4 },
          { "date": "2026-06-03", "clicks": 5 },
          { "date": "2026-06-04", "clicks": 5 },
          { "date": "2026-06-05", "clicks": 5 },
          { "date": "2026-06-06", "clicks": 0 }
        ]
      },
      {
        "id": "link-004",
        "code": "referral-bonus-link",
        "title": "Referral Bonus Program",
        "targetUrl": "https://example.com/referral?code=JOHN123",
        "category": "referral",
        "clickCount": 22,
        "lastClickedAt": "2026-06-06T09:22:15.000Z",
        "createdAt": "2026-06-01T16:45:00.000Z",
        "dailyClicks": [
          { "date": "2026-06-01", "clicks": 2 },
          { "date": "2026-06-02", "clicks": 3 },
          { "date": "2026-06-03", "clicks": 4 },
          { "date": "2026-06-04", "clicks": 5 },
          { "date": "2026-06-05", "clicks": 5 },
          { "date": "2026-06-06", "clicks": 3 }
        ]
      }
    ]
  }
}
```

### Interpretation
- **Total Clicks:** 127 over 7 days
- **Daily Average:** 18.14 clicks/day
- **Trend:** UP (second half getting more clicks than first half)
- **Top Link:** "cruise-gold-50off" with 45 clicks (35% of total)
- **Growth Pattern:** Most links show upward trend in recent days

---

## Example 2: Month-Long Analysis

### Request
```bash
curl -X GET \
  'http://localhost:3000/api/analytics/shortlink-performance?organizationId=org-mabiz-cruise&createdBy=user-jane-smith&days=30' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Response (200 OK)
```json
{
  "ok": true,
  "data": {
    "total": {
      "clickCount": 890,
      "averageClicksPerDay": 29.67,
      "trend": "flat"
    },
    "shortLinks": [
      {
        "id": "link-005",
        "code": "facebook-campaign-jun",
        "title": "Facebook Campaign - June",
        "targetUrl": "https://example.com/campaign/facebook-jun",
        "category": "social",
        "clickCount": 450,
        "lastClickedAt": "2026-06-06T16:00:00.000Z",
        "createdAt": "2026-05-10T09:00:00.000Z",
        "dailyClicks": [
          { "date": "2026-05-10", "clicks": 25 },
          { "date": "2026-05-11", "clicks": 28 },
          // ... 28 more days ...
          { "date": "2026-06-06", "clicks": 12 }
        ]
      }
    ]
  }
}
```

### Key Insights
- Stable performance (FLAT trend)
- Consistent ~30 clicks/day across the month
- Facebook campaign is strongest performer (450/890 = 50.6%)

---

## Example 3: Contact-Level Click Analysis

### Request
```bash
curl -X GET \
  'http://localhost:3000/api/analytics/shortlink-clicks-by-contact?linkId=link-cruise-gold-50off&limit=15' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Response (200 OK)
```json
{
  "ok": true,
  "data": [
    {
      "contactId": "contact-kim-001",
      "contactName": "김철수",
      "contactPhone": "010-1234-5678",
      "clicks": 5,
      "lastClickedAt": "2026-06-06T14:30:00.000Z"
    },
    {
      "contactId": "contact-lee-002",
      "contactName": "이영희",
      "contactPhone": "010-2345-6789",
      "clicks": 4,
      "lastClickedAt": "2026-06-05T10:15:00.000Z"
    },
    {
      "contactId": "contact-park-003",
      "contactName": "박민준",
      "contactPhone": "010-3456-7890",
      "clicks": 3,
      "lastClickedAt": "2026-06-04T09:45:00.000Z"
    },
    {
      "contactId": null,
      "contactName": null,
      "contactPhone": null,
      "clicks": 33,
      "lastClickedAt": "2026-06-06T15:20:00.000Z"
    }
  ]
}
```

### Interpretation
- **Top Engagers:**
  - 김철수: 5 clicks (highly interested)
  - 이영희: 4 clicks (engaged)
  - 박민준: 3 clicks (interested)
- **Anonymous Clicks:** 33 clicks from unknown/untracked sources (61% of total)
- **Action Items:**
  - Follow up with 김철수 (highest engagement)
  - Investigate source of 33 anonymous clicks (organic?/social?)

---

## Example 4: Using TypeScript Utility Functions

### Get Analytics Data Programmatically
```typescript
import { getShortLinkAnalytics, getShortLinkAggregateStats } from '@/lib/analytics/shortlink'

// In a Next.js API route or server action
export async function getMyShortLinkStats() {
  const orgId = 'org-mabiz-cruise'
  const userId = 'user-john-doe'
  
  // Option 1: Detailed analytics
  const analytics = await getShortLinkAnalytics(orgId, userId, 7)
  console.log(`Total links: ${analytics.length}`)
  console.log(`Top link: ${analytics[0].code} with ${analytics[0].clickCount} clicks`)
  
  // Option 2: Summary statistics
  const stats = await getShortLinkAggregateStats(orgId, userId, 7)
  console.log(`Total clicks: ${stats.totalClicks}`)
  console.log(`Trend: ${stats.trend}`)
  console.log(`Top link: ${stats.topLink?.code} (${stats.topLink?.clicks} clicks)`)
  
  return { analytics, stats }
}
```

### Output
```
Total links: 4
Top link: cruise-gold-50off with 45 clicks

Total clicks: 127
Trend: up
Top link: cruise-gold-50off (45 clicks)
```

---

## Example 5: Frontend Integration (React Component)

### Dashboard Component
```typescript
import { useEffect, useState } from 'react'
import type { ShortLinkPerformanceResponse } from '@/types/analytics'

export default function ShortLinkDashboard() {
  const [analytics, setAnalytics] = useState<ShortLinkPerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      const res = await fetch(
        `/api/analytics/shortlink-performance?organizationId=org-123&createdBy=user-456&days=7`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      const data: ShortLinkPerformanceResponse = await res.json()
      setAnalytics(data)
      setLoading(false)
    }

    fetchAnalytics()
  }, [])

  if (loading) return <div>Loading analytics...</div>
  if (!analytics?.ok) return <div>Error: {analytics?.error}</div>

  const { total, shortLinks } = analytics.data!

  return (
    <div className="dashboard">
      <h1>ShortLink Performance</h1>
      
      {/* Summary Cards */}
      <div className="summary-cards">
        <Card title="Total Clicks" value={total.clickCount} />
        <Card title="Daily Average" value={total.averageClicksPerDay.toFixed(1)} />
        <Card title="Trend" value={total.trend.toUpperCase()} />
      </div>

      {/* Links Table */}
      <table>
        <thead>
          <tr>
            <th>Link Code</th>
            <th>Title</th>
            <th>Clicks</th>
            <th>Last Clicked</th>
            <th>Chart</th>
          </tr>
        </thead>
        <tbody>
          {shortLinks.map((link) => (
            <tr key={link.id}>
              <td><code>{link.code}</code></td>
              <td>{link.title || '(No title)'}</td>
              <td><strong>{link.clickCount}</strong></td>
              <td>{link.lastClickedAt ? new Date(link.lastClickedAt).toLocaleDateString() : 'Never'}</td>
              <td>
                <MiniChart data={link.dailyClicks} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Example 6: Error Handling

### Missing Parameters
```bash
curl -X GET \
  'http://localhost:3000/api/analytics/shortlink-performance' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Response (400 Bad Request)
```json
{
  "ok": false,
  "data": null,
  "error": "Missing required parameters"
}
```

---

### Unauthorized Access
```bash
curl -X GET \
  'http://localhost:3000/api/analytics/shortlink-performance?organizationId=org-123&createdBy=user-456&days=7'
```

### Response (401 Unauthorized)
```json
{
  "ok": false,
  "data": null,
  "error": "Unauthorized"
}
```

---

### ShortLink Not Found
```bash
curl -X GET \
  'http://localhost:3000/api/analytics/shortlink-clicks-by-contact?linkId=non-existent-link' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Response (404 Not Found)
```json
{
  "ok": false,
  "data": null,
  "error": "ShortLink not found"
}
```

---

## Example 7: Export to CSV

### Node.js Script
```typescript
import { stringify } from 'csv-stringify'
import { getShortLinkAnalytics } from '@/lib/analytics/shortlink'
import fs from 'fs'

async function exportAnalytics(orgId: string, userId: string) {
  const analytics = await getShortLinkAnalytics(orgId, userId, 30)
  
  const rows = analytics.map(link => ({
    code: link.code,
    title: link.title,
    category: link.category,
    totalClicks: link.clickCount,
    weeklyClicks: link.weeklyClicks,
    monthlyClicks: link.monthlyClicks,
    lastClicked: link.lastClickedAt?.toISOString() || 'Never',
    created: link.createdAt.toISOString()
  }))
  
  stringify(rows, { header: true }, (err, output) => {
    if (err) throw err
    fs.writeFileSync('shortlink-analytics.csv', output)
    console.log('✅ Exported to shortlink-analytics.csv')
  })
}
```

### CSV Output
```csv
code,title,category,totalClicks,weeklyClicks,monthlyClicks,lastClicked,created
cruise-gold-50off,50% Off Gold Cruise Package,promotion,45,30,120,2026-06-06T15:30:22.000Z,2026-06-01T10:00:00.000Z
rental-summer-deals,Summer Rental Deals,seasonal,38,25,95,2026-06-06T14:15:10.000Z,2026-05-15T08:30:00.000Z
vip-member-exclusive,VIP Member Exclusive Access,member,22,15,50,2026-06-05T11:45:00.000Z,2026-05-20T14:20:00.000Z
```

---

## Example 8: Monitoring & Alerts

### Check for Declining Performance
```typescript
async function monitorPerformance(orgId: string, userId: string) {
  const stats = await getShortLinkAggregateStats(orgId, userId, 7)
  
  if (stats.trend === 'down') {
    console.warn(`⚠️ Performance declining: ${stats.totalClicks} clicks (avg: ${stats.averageClicksPerDay}/day)`)
    // Send alert to user
  }
  
  if (stats.totalClicks < stats.linkCount * 2) {
    console.warn(`⚠️ Low engagement: Only ${stats.totalClicks} clicks for ${stats.linkCount} links`)
    // Suggest optimization
  }
}
```

---

## Example 9: Comparison (Week vs Week)

### Request
```bash
# This week
curl -X GET \
  'http://localhost:3000/api/analytics/shortlink-performance?organizationId=org-123&createdBy=user-456&days=7' \
  -H 'Authorization: Bearer TOKEN' > week1.json

# Last week (would need to query manually with date filters in future implementation)
```

### Analysis Script
```typescript
const thisWeek = JSON.parse(fs.readFileSync('week1.json', 'utf-8')).data
const lastWeek = previousWeekData // stored or cached

const improvement = (
  ((thisWeek.total.clickCount - lastWeek.total.clickCount) / lastWeek.total.clickCount) * 100
).toFixed(1)

console.log(`Week-over-week: ${improvement}% change`)
```

---

## Performance Tips

1. **Cache Results:** Cache `/api/analytics/shortlink-performance` for 5 minutes
2. **Limit Records:** Use default `limit=10` for contact breakdown to avoid large responses
3. **Batch Queries:** Combine multiple links into one analytics request rather than individual calls
4. **Archive Old Data:** Consider archiving clicks older than 1 year for performance

---

## Next Steps

- Integrate examples into your dashboard
- Set up alerts for declining performance
- Export analytics for reporting
- Create custom views for different team members
