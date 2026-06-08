# ShortLink Analytics API Design (Option A - Database Migration)

## Overview

This document specifies the analytics API for ShortLink performance tracking, following **Option A: Database + API Design** approach.

## Architecture

### Database Layer

**Existing Models:**
- `ShortLink` (lines 1686-1705 in schema.prisma)
- `ShortLinkClick` (lines 1707-1717 in schema.prisma) — Already exists with all required fields

**ShortLinkClick Structure:**
```prisma
model ShortLinkClick {
  id        String    @id @default(cuid())
  linkId    String
  contactId String?
  clickedAt DateTime  @default(now())
  userAgent String?
  contact   Contact?  @relation(fields: [contactId], references: [id], onDelete: SetNull)
  link      ShortLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  @@map("ShortLinkClick")
}
```

**Indexes Added:**
- `idx_shortlinkclick_linkid_clickedat` — Optimizes groupBy + date range queries
- `idx_shortlinkclick_contactid` — Optimizes contact-based analysis
- `idx_shortlinkclick_linkid_date` — Date-based aggregation performance
- `idx_shortlinkclick_perf` — Composite index for common analytics patterns

### API Endpoints

#### 1. GET `/api/analytics/shortlink-performance`

**Purpose:** Get aggregated performance metrics for all shortlinks created by a user

**Query Parameters:**
```typescript
{
  organizationId: string    // Required: Organization ID
  createdBy: string         // Required: User ID (OrganizationMember.userId)
  days?: number            // Optional: Look-back period (default: 7)
  groupBy?: 'daily' | 'hourly'  // Optional: Time granularity (default: 'daily')
}
```

**Response (200 OK):**
```typescript
{
  ok: true,
  data: {
    total: {
      clickCount: number           // Total clicks across all links
      averageClicksPerDay: number  // Arithmetic mean
      trend: 'up' | 'down' | 'flat' // Based on first half vs second half
    },
    shortLinks: [
      {
        id: string
        code: string              // Unique short code (e.g., "abc123")
        title: string | null
        targetUrl: string
        category: string | null
        clickCount: number        // Total clicks for this link
        lastClickedAt: Date | null
        createdAt: Date
        dailyClicks?: [
          { date: "2026-06-01", clicks: 5 },
          { date: "2026-06-02", clicks: 7 }
        ]
      }
    ]
  }
}
```

**Error Responses:**
```typescript
// 400 Bad Request
{ ok: false, error: "Missing required parameters" }

// 401 Unauthorized
{ ok: false, error: "Unauthorized" }

// 500 Internal Server Error
{ ok: false, error: "Description of error" }
```

**Query Logic:**
1. Fetch all active shortlinks for the user (organizationId + createdBy)
2. Group ShortLinkClick by linkId to get total clicks
3. Time-series aggregation (daily or hourly) using raw SQL date binning
4. Calculate trend by comparing first half vs second half of period
5. Return results sorted by clickCount descending

**Performance Characteristics:**
- Typical response time: 100-300ms for 10-50 links
- Database queries: 4-5 round trips (list links, click stats, time series, trend calc)
- Index utilization: `idx_shortlinkclick_linkid_clickedat`, `idx_shortlinkclick_linkid_date`

#### 2. GET `/api/analytics/shortlink-clicks-by-contact`

**Purpose:** Detailed breakdown of clicks per contact for a specific shortlink

**Query Parameters:**
```typescript
{
  linkId: string      // Required: ShortLink ID
  limit?: number      // Optional: Max results (default: 10, max: 100)
}
```

**Response (200 OK):**
```typescript
{
  ok: true,
  data: [
    {
      contactId: string | null     // null if no contact associated
      contactName: string | null   // Contact.name
      contactPhone: string | null  // Contact.phone
      clicks: number               // Aggregated clicks
      lastClickedAt: string        // ISO timestamp
    }
  ]
}
```

**Error Responses:**
```typescript
// 400 Bad Request
{ ok: false, error: "Missing required parameter: linkId" }

// 404 Not Found
{ ok: false, error: "ShortLink not found" }

// 401 Unauthorized
{ ok: false, error: "Unauthorized" }
```

**Query Logic:**
1. Verify ShortLink ownership (check createdBy matches auth)
2. LEFT JOIN ShortLinkClick with Contact
3. GROUP BY contactId, contactName, contactPhone
4. ORDER BY clickCount DESC
5. Apply limit
6. Return results

**Performance Characteristics:**
- Typical response time: 50-150ms
- Database queries: 1 round trip (prepared statement with JOIN + GROUP BY)
- Index utilization: `idx_shortlinkclick_contactid`, `idx_shortlinkclick_linkid_contactid`

### Utility Library

**Location:** `src/lib/analytics/shortlink.ts`

**Key Functions:**

#### `getShortLinkAnalytics(organizationId, createdBy, days)`
Returns detailed analytics for all shortlinks with daily click breakdown.

```typescript
interface ShortLinkAnalytics {
  linkId: string
  code: string
  title: string | null
  targetUrl: string
  category: string | null
  clickCount: number
  lastClickedAt: Date | null
  createdAt: Date
  dailyClicks: Array<{ date: string; clicks: number }>
  weeklyClicks?: number
  monthlyClicks?: number
}
```

#### `getShortLinkAggregateStats(organizationId, createdBy, days)`
Returns summary statistics across all user's shortlinks.

```typescript
interface AggregateStats {
  totalClicks: number
  averageClicksPerDay: number
  trend: 'up' | 'down' | 'flat'
  linkCount: number
  topLink: { code: string; clicks: number } | null
}
```

#### `getShortLinkClicksByContact(linkId, limit)`
Returns click breakdown by contact for a specific link.

### Type Definitions

**Location:** `src/types/analytics.ts`

Provides TypeScript interfaces for all API responses, ensuring type safety across the codebase.

## Data Flow

### Click Recording Flow
```
User clicks shortlink
  ↓
Next.js redirect handler (existing)
  ↓
Create ShortLinkClick record
  ↓
Database persists with clickedAt timestamp
  ↓
ShortLink.clickCount incremented
```

### Analytics Query Flow
```
Dashboard requests /api/analytics/shortlink-performance
  ↓
Fetch active ShortLinks (organizationId + createdBy)
  ↓
Query ShortLinkClick groupBy stats
  ↓
Time-series aggregation (daily/hourly)
  ↓
Trend calculation
  ↓
Return sorted results
```

## Performance Optimization

### Query Strategy
1. **Grouped Aggregation:** Use PostgreSQL `GROUP BY` + `COUNT(*)` instead of fetching all rows
2. **Index Utilization:** Composite indexes on (linkId, clickedAt) for rapid filtering
3. **Partial Indexes:** Consider future partial indexes on isActive=true links
4. **Time-Range Queries:** Efficient due to clickedAt index with DESC sort

### Expected Metrics
| Scenario | Links | Days | Clicks | Query Time |
|----------|-------|------|--------|------------|
| New user | 5 | 7 | 100 | 50ms |
| Active user | 20 | 30 | 5K | 150ms |
| Power user | 100 | 90 | 100K | 500ms |

### Caching Recommendations
- Cache `/api/analytics/shortlink-performance` for 5 minutes (stable data)
- Real-time click counts can be fetched separately
- Use ETag headers for 304 Not Modified responses

## Security Considerations

### Access Control
- ✅ Verify `organizationId` matches authenticated user's organization
- ✅ Verify `createdBy` matches authenticated user's ID
- ✅ Admin can view all users' links within organization

### Data Privacy
- ShortLinkClick.contactId can be null (anonymous clicks)
- Contact details (phone, name) exposed in clicks-by-contact endpoint — validate permissions
- Consider data retention policies for old clicks

### Rate Limiting
- Recommend 100 requests/minute per user
- Implement backoff for bulk exports (if added)

## Future Enhancements

### Option C (if needed): Real-time Features
- WebSocket subscriptions for live click counts
- Streaming analytics dashboard
- Real-time notifications on milestone clicks (100, 500, 1000)

### Advanced Analytics
- Referrer tracking (source of click)
- Geographic distribution (GeoIP lookup)
- Device/OS breakdown (userAgent parsing)
- Conversion tracking (clicks → purchase)
- UTM parameter analysis

### Reporting
- CSV/Excel export of performance data
- Email digest (daily/weekly/monthly)
- Comparative analysis (link vs link, period vs period)
- Predictive analytics (forecast future clicks)

## Testing

### Unit Tests
- Test trend calculation logic
- Verify date binning for daily/hourly
- Check null handling (anonymous clicks)

### Integration Tests
- Test with various click patterns (uniform, spiky, declining)
- Verify permission checks
- Test edge cases (no links, no clicks, single click)

### Load Tests
- 100 simultaneous analytics requests
- Query performance with 1M+ clicks

## Migration Plan

1. **Indexes:** Apply `shortlink_analytics_indexes.sql` migration
2. **API Routes:** Deploy new endpoints
3. **Utilities:** Make `src/lib/analytics/shortlink.ts` available
4. **Frontend:** Consume endpoints in analytics dashboard (if applicable)

## API Usage Examples

### Example 1: Get performance for past 7 days
```bash
GET /api/analytics/shortlink-performance?organizationId=org-123&createdBy=user-456&days=7
```

### Example 2: Get hourly breakdown for past day
```bash
GET /api/analytics/shortlink-performance?organizationId=org-123&createdBy=user-456&days=1&groupBy=hourly
```

### Example 3: Get contacts who clicked a link
```bash
GET /api/analytics/shortlink-clicks-by-contact?linkId=link-789&limit=20
```

## Summary

**Option A (Database + API)** provides:
- ✅ Real-time performance metrics
- ✅ Granular click tracking (daily/hourly)
- ✅ Contact-level insights
- ✅ Scalable to millions of clicks
- ✅ Extensible for future analytics
- ✅ Minimal data storage overhead (ShortLinkClick already exists)
- ✅ SQL-optimized queries with proper indexing

**Trade-offs:**
- Requires database migrations (low risk)
- Adds ~5 API endpoints (manageable)
- Query complexity for very large datasets (addressed by indexes)

This approach aligns with the existing CRM architecture and provides a robust foundation for analytics features.
