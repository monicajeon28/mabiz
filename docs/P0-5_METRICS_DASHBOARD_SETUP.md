# P0-5 Metrics Dashboard Setup

## Overview

Post-deployment metrics tracking for Server Component optimization (P0-5)

---

## Automated Metrics Collection

### 1. Lighthouse CI Integration

**Setup** (requires `@lhci/cli`):

```bash
# Install globally
npm install -g @lhci/cli@latest

# Or add to project
npm install --save-dev @lhci/cli@latest
```

**Configuration** (`lighthouse.json`):

```json
{
  "ci": {
    "collect": {
      "url": ["https://mabizcruisedot.com/dashboard"],
      "numberOfRuns": 3,
      "headless": true,
      "chromePath": "",
      "settings": {
        "configPath": "./lighthouse-config.js"
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "cumulatively-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**Lighthouse config** (`lighthouse-config.js`):

```javascript
module.exports = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    throttling: {
      rttMs: 150,
      throughputKbps: 1.6 * 1024,
      cpuSlowdownMultiplier: 1,
    },
  },
};
```

**GitHub Actions integration** (`.github/workflows/lighthouse-ci.yml`):

```yaml
name: Lighthouse CI
on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          configPath: ./lighthouse.json
          temporaryPublicStorage: true
```

**Run manually**:

```bash
lhci autorun --config=lighthouse.json
```

**View results**:

The report uploads to Lighthouse CI storage. URL will be printed in console:
```
https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/...
```

---

### 2. Web Vitals Collection

**Install Web Vitals library**:

```bash
npm install web-vitals
```

**Add to client component** (`src/app/(dashboard)/dashboard-client.tsx`):

```typescript
'use client';

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import { logger } from '@/lib/logger';

// Report Web Vitals to monitoring service
function sendMetricsToAnalytics(metric: any) {
  if (typeof window !== 'undefined') {
    // Send to your analytics backend
    navigator.sendBeacon('/api/metrics', JSON.stringify({
      name: metric.name,
      value: Math.round(metric.value),
      timestamp: new Date().toISOString(),
      url: window.location.pathname,
    }));
  }
}

// Register Web Vitals observers
getCLS(sendMetricsToAnalytics);
getFID(sendMetricsToAnalytics);
getFCP(sendMetricsToAnalytics);
getLCP(sendMetricsToAnalytics);
getTTFB(sendMetricsToAnalytics);

export function DashboardClient() {
  // ... existing code ...
}
```

**Create metrics API endpoint** (`src/app/api/metrics/route.ts`):

```typescript
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info('web-vital', {
      metricName: body.name,
      metricValue: body.value,
      url: body.url,
      timestamp: body.timestamp,
    });
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

---

### 3. Performance Observer Integration

**Add to layout.tsx** (Server Component wrapper):

```typescript
// src/app/(dashboard)/instrumentation.ts
import { logger } from '@/lib/logger';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation
    const { setupServerMonitoring } = await import('./server-monitoring');
    setupServerMonitoring();
  }
}
```

**Create server monitoring** (`src/app/(dashboard)/server-monitoring.ts`):

```typescript
import { logger } from '@/lib/logger';
import { getMabizSession } from '@/lib/auth';

const sessionTimings: Array<{ duration: number; timestamp: Date }> = [];

// Wrap getMabizSession to track timing
const originalGetMabizSession = getMabizSession;
export async function trackedGetMabizSession() {
  const startTime = Date.now();
  try {
    const result = await originalGetMabizSession();
    const duration = Date.now() - startTime;
    
    sessionTimings.push({
      duration,
      timestamp: new Date(),
    });
    
    // Log every 10th call
    if (sessionTimings.length % 10 === 0) {
      const avgDuration = sessionTimings.reduce((sum, t) => sum + t.duration, 0) / sessionTimings.length;
      logger.info('getMabizSession stats', {
        totalCalls: sessionTimings.length,
        averageDuration: Math.round(avgDuration),
        maxDuration: Math.max(...sessionTimings.map(t => t.duration)),
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('getMabizSession failed', {
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export function setupServerMonitoring() {
  // Called on server startup
  logger.info('Server monitoring initialized');
}
```

---

## Manual Metrics Tracking

### Daily Checklist

Create a spreadsheet to track daily metrics:

| Date | TTI (ms) | LCP (ms) | FCP (ms) | API Calls | Errors | Notes |
|------|----------|----------|----------|-----------|--------|-------|
| 2026-05-20 | 3800 | 2900 | 1600 | 3 | 0 | Baseline |
| 2026-05-21 | 3750 | 2850 | 1550 | 3 | 0 | Stable ✅ |
| 2026-05-22 | 3770 | 2880 | 1580 | 3 | 0 | Stable ✅ |

**How to measure**:

1. Open DevTools → Network tab
2. Hard refresh (Cmd+Shift+R)
3. Measure:
   - **TTI**: DevTools → Performance tab → Look for "domInteractive"
   - **LCP**: DevTools → Lighthouse tab → Run audit
   - **FCP**: DevTools → Lighthouse tab → Run audit
   - **API Calls**: Count requests in Network tab

---

## Error Tracking Integration

### Sentry Setup

If using Sentry:

```typescript
// src/lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  
  // Custom transaction filters
  beforeSend(event) {
    // Ignore harmless errors
    if (event.message?.includes('ResizeObserver')) return null;
    return event;
  },
});

// Monitor performance metrics
Sentry.captureCheckIn({
  monitorSlug: 'dashboard-performance',
  status: 'ok',
  duration: ttifromPerformanceAPI,
});
```

**Create alerts for regressions**:

1. Go to Sentry.io dashboard
2. Alerts → Create alert
3. Set condition: `"TTI" > 4500ms` (20% slower than target)
4. Action: Send email notification

---

## Real User Monitoring (RUM)

### Google Analytics Integration

```typescript
// src/app/(dashboard)/dashboard-client.tsx
import { useEffect } from 'react';

export function DashboardClient() {
  useEffect(() => {
    // Track custom metrics
    if (typeof gtag === 'function') {
      const tti = performance.timing.domInteractive - performance.timing.navigationStart;
      const lcp = Math.max(...performance
        .getEntriesByType('largest-contentful-paint')
        .map(e => (e as any).renderTime || (e as any).loadTime));
      
      gtag('event', 'page_metrics', {
        tti: Math.round(tti),
        lcp: Math.round(lcp),
        url: window.location.pathname,
      });
    }
  }, []);
  
  return (/* ... */);
}
```

**Query data in Google Analytics**:

1. GA dashboard → Custom → Custom events
2. Filter by `page_metrics`
3. View by `tti` and `lcp` dimensions
4. Compare before/after deployment dates

---

## Database Query Monitoring

### Prisma Query Logging

**Enable in environment**:

```bash
# .env.local
DATABASE_URL="postgresql://..."
DEBUG="prisma:*"
```

**Or programmatically**:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

prisma.$on('query', (e) => {
  if (e.query.includes('mabizSession')) {
    console.log('Session query:', {
      duration: e.duration,
      timestamp: new Date().toISOString(),
    });
  }
});

export default prisma;
```

**Parse logs to extract session query frequency**:

```bash
# Extract session queries from logs
grep -E '"query":"SELECT.*mabizSession' app.log | wc -l

# Expected after P0-5:
# - Before: ~600-700 queries/hour
# - After: ~200-300 queries/hour (67% reduction)
```

---

## Dashboard Templates

### Grafana Dashboard (if using)

```json
{
  "dashboard": {
    "title": "P0-5 Server Component Performance",
    "panels": [
      {
        "title": "TTI (Time to Interactive)",
        "targets": [
          {
            "expr": "avg(dashboard_tti_ms)"
          }
        ]
      },
      {
        "title": "API Calls per Page Load",
        "targets": [
          {
            "expr": "count(http_requests{path='/api/*'})"
          }
        ]
      },
      {
        "title": "getMabizSession Query Count/Hour",
        "targets": [
          {
            "expr": "rate(query_count{query='mabizSession'}[1h])"
          }
        ]
      }
    ]
  }
}
```

---

## Alert Configuration

### Performance Regression Alert

**Trigger conditions**:

- TTI increases by > 200ms (threshold crossed to bad)
- LCP increases by > 150ms
- API calls > 5 per page load
- Database query rate increases (indicates 2+ calls to /api/auth/me)

**Notification**:

1. **Slack**: Send to #engineering channel
2. **Email**: Send to performance team
3. **PagerDuty**: Page on-call if P0 regression

**Example Slack alert**:

```
🚨 P0-5 Performance Regression Detected

📊 Metrics:
- TTI: 3.8s → 4.1s (+300ms) ⚠️
- LCP: 2.9s → 3.0s (+100ms)
- API Calls: 3 → 4 calls

🔍 Probable cause: Check Network tab for /api/auth/me duplication
🔧 Rollback plan: git revert <commit> && git push

Full dashboard: [Grafana Link]
```

---

## Weekly Report Template

**Subject**: P0-5 Performance Report — Week 1

```markdown
## Executive Summary
Server Component optimization deployed 2026-05-20.
Performance metrics stable ✅

## Key Metrics
- TTI: 3.8s ± 0.2s (baseline: 4.2s, improvement: -400ms) ✅
- LCP: 2.9s ± 0.15s (baseline: 3.1s, improvement: -200ms) ✅
- API calls: 3.2 avg (baseline: 4.5, improvement: -1.3 calls) ✅
- Error rate: 0.02% (baseline: 0.01%, regression: +0.01%)

## Database Queries
- getMabizSession calls: 250/hour (baseline: 750/hour, reduction: 67%) ✅
- Average query duration: 12ms (baseline: 12ms, no regression) ✅

## User Impact
- No complaints reported ✅
- Lighthouse score: 87/100 (baseline: 82/100) ✅
- Mobile TTI (Slow 3G): 3.9s (baseline: 4.7s, improvement: -800ms) ✅

## Incidents
- None reported ✅

## Next Steps
- Continue monitoring for 2 more weeks
- Plan P1 optimizations (Redis caching, parallel loading)
- Review mobile performance on real devices

---
Generated: 2026-05-27
Agent: β (Performance & Optimization)
```

---

## Success Criteria (Final Validation)

After 1 week of monitoring:

- [ ] TTI stable: ±100ms variance (no regression)
- [ ] LCP stable: ±50ms variance
- [ ] API calls: consistently 3-4 (no spikes)
- [ ] /api/auth/me calls: 0 in Network tab
- [ ] Error rate: no increase
- [ ] User complaints: 0
- [ ] Database queries: 60-70% reduction confirmed

**If all checks pass**: Mark P0-5 as COMPLETE, move to P1 planning

---

**Created**: 2026-05-20
**Agent**: β (Performance & Optimization)
**Purpose**: Post-deployment metrics tracking
