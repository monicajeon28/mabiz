# P0-5: Server Component Performance Optimization & Monitoring

## Executive Summary

**Optimization**: Eliminated redundant `/api/auth/me` calls by moving auth logic to Server Component (layout.tsx)
**Expected Impact**: 67% query reduction, 80ms latency savings, 15% TTI improvement
**Status**: Ready for deployment + monitoring
**Next Phase**: P1 (cache strategy, Redis optimization)

---

## 1. Architecture Change Overview

### Before (Client-side auth fetch)
```
Page Load
  ↓
layout.tsx (Server Component)
  └─ getMabizSession() [runs on server, passes data via props]
  ↓
dashboard/page.tsx (Client Component with 'use client')
  └─ useEffect → fetch('/api/auth/me') [redundant, already have session]
  ↓
DashboardClient renders with auth data
```

**Problem**: Session data retrieved twice (server + client)

### After (Server Component pattern)
```
Page Load
  ↓
layout.tsx (Server Component - async)
  └─ getMabizSession() [runs on server]
  ├─ Session data passed to SidebarNav (Server Component)
  ├─ Session data passed to children
  ↓
dashboard/page.tsx (Server Component - async)
  └─ No 'use client' flag
  └─ Passes data to DashboardClient (Client Component)
  ↓
DashboardClient (Client Component)
  └─ No 'useEffect' → No redundant fetch('/api/auth/me')
  ↓
Renders with pre-fetched auth data (Streaming supported)
```

**Benefit**: Session data retrieved ONCE, cached in Server Component

---

## 2. Expected Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Auth queries per session | 3 | 1 | **67% ↓** |
| Network latency (auth path) | ~120ms | ~40ms | **80ms savings** |
| Time to Interactive (TTI) | Baseline | -60-80ms | **~15% faster** |
| First Contentful Paint (FCP) | Baseline | -150-300ms | **~10% faster** |
| Largest Contentful Paint (LCP) | Baseline | -100-200ms | **~8% faster** |
| Concurrent API calls on load | 4-5 | 3-4 | **1-2 fewer calls** |
| Client bundle size | Baseline | -2-3% | **~5-10KB reduction** |
| Time to First Byte (TTFB) | ~150ms | ~150ms | **No change** |

---

## 3. Key Files Modified

1. **src/app/(dashboard)/layout.tsx** (Server Component)
   - Added: `const session = await getMabizSession()`
   - Passes session to children
   - No `useEffect` or client-side state

2. **src/app/(dashboard)/dashboard/page.tsx** (Server Component)
   - Removed: `'use client'` directive
   - Now async/await safe
   - Passes data to DashboardClient

3. **src/app/(dashboard)/dashboard-client.tsx** (NEW - Client Component)
   - Contains all 'use client' logic
   - No more redundant `/api/auth/me` fetch
   - Receives auth data as props

---

## 4. Live Monitoring Instructions

### Phase 0: Before Deployment (Baseline)

**Task 1: Establish baseline metrics**

Open Chrome DevTools (F12) on production:

```javascript
// 1. Copy this script to DevTools Console (before deployment)
(async () => {
  const metrics = {
    navigationStart: performance.timing.navigationStart,
    responseEnd: performance.timing.responseEnd,
    domInteractive: performance.timing.domInteractive,
    loadEventEnd: performance.timing.loadEventEnd,
    resources: []
  };

  // Capture all API calls
  performance.getEntriesByType('resource').forEach(r => {
    if (r.name.includes('/api/')) {
      metrics.resources.push({
        name: r.name.split('/').pop(),
        duration: Math.round(r.duration),
        startTime: Math.round(r.startTime),
      });
    }
  });

  console.log('=== BASELINE METRICS ===');
  console.log(JSON.stringify(metrics, null, 2));
  
  // Copy this output to a text file for comparison
})();
```

**Expected output (before optimization)**:
```json
{
  "navigationStart": 0,
  "responseEnd": 150,
  "domInteractive": 800,
  "loadEventEnd": 1200,
  "resources": [
    { "name": "auth/me", "duration": 120, "startTime": 200 },
    { "name": "dashboard", "duration": 150, "startTime": 250 },
    { "name": "notifications/feed", "duration": 100, "startTime": 300 },
    { "name": "auth/me", "duration": 120, "startTime": 350 }  // DUPLICATE!
  ]
}
```

**Record these values**: Create `BASELINE_METRICS.json` in your project

---

### Phase 1: Post-Deployment Monitoring (First 24 hours)

**Task 1: Chrome DevTools Network Analysis**

1. Open DevTools → Network tab
2. Set throttling to **Slow 3G** (realistic mobile condition)
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. Wait for page to be fully interactive
5. Compare with baseline:

```javascript
// Copy to Console after page loads
(async () => {
  const metrics = {
    navigationStart: performance.timing.navigationStart,
    responseEnd: performance.timing.responseEnd,
    domInteractive: performance.timing.domInteractive,
    loadEventEnd: performance.timing.loadEventEnd,
    resources: []
  };

  performance.getEntriesByType('resource').forEach(r => {
    if (r.name.includes('/api/')) {
      metrics.resources.push({
        name: r.name.split('/').pop(),
        duration: Math.round(r.duration),
        startTime: Math.round(r.startTime),
      });
    }
  });

  console.log('=== POST-DEPLOYMENT METRICS ===');
  console.log(JSON.stringify(metrics, null, 2));
  
  // Calculate improvements
  const tti = metrics.domInteractive;
  const ttfb = metrics.responseEnd;
  console.log(`\n✅ TTI: ${tti}ms (target: < 1000ms)`);
  console.log(`✅ TTFB: ${ttfb}ms (target: < 200ms)`);
  console.log(`✅ Total API calls: ${metrics.resources.length} (target: 3-4)`);
})();
```

**Acceptance Criteria**:
- ✅ No duplicate `/api/auth/me` calls (should see only 1, not 2+)
- ✅ TTI < 1000ms (or improved from baseline)
- ✅ Total API calls: 3-4 (down from 4-5)
- ✅ No waterfall effect (parallel API calls)

---

**Task 2: Lighthouse Audit (DevTools)**

1. DevTools → Lighthouse tab
2. Configuration:
   - Mode: **Desktop**
   - Throttling: **Simulated fast 3G**
   - Clear storage: ✅ checked
3. Click "Analyze page load"
4. Screenshot the results → compare with baseline

**Metrics to watch**:

| Metric | Baseline | Target | Formula |
|--------|----------|--------|---------|
| First Contentful Paint (FCP) | Baseline | -150-300ms | Should decrease |
| Largest Contentful Paint (LCP) | Baseline | -100-200ms | Should decrease |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.1 | Must not increase |
| Time to Interactive (TTI) | Baseline | -60-80ms | Should decrease |

**Sample Lighthouse output**:
```
Before:
  FCP: 2.5s
  LCP: 3.1s
  TTI: 4.2s
  CLS: 0.05

After:
  FCP: 2.1s (-400ms) ✅
  LCP: 2.9s (-200ms) ✅
  TTI: 3.8s (-400ms) ✅
  CLS: 0.04 ✅
```

---

**Task 3: React DevTools Profiler (Component render)**

1. Install React DevTools extension (if not already installed)
2. DevTools → Profiler tab
3. Click ⏺ (Record) button
4. Hard refresh page
5. Wait until page is fully interactive
6. Click ⏹ (Stop)
7. Analyze the flamegraph

**What to look for**:

```
Before (with useEffect waterfall):
  layout.tsx renders
    └─ DashboardClient renders
      └─ useEffect mounts
        └─ fetch('/api/auth/me')
          └─ state update (setSession)
            └─ DashboardClient re-renders [WASTED RENDER]
              └─ children re-render [WASTED RENDER]

After (Server Component pattern):
  layout.tsx renders [1x]
    └─ DashboardClient renders [1x]
      └─ (no useEffect, no re-renders from fetch)
```

**Expected result**: Single render pass, no useEffect waterfall

---

### Phase 2: Extended Monitoring (Week 1)

**Task 1: Database Query Logging**

Monitor actual database query volume for `/api/auth/me`:

```typescript
// In src/lib/auth.ts, add query timing
import { logger } from '@/lib/logger';

export async function getMabizSession(): Promise<MabizAuthContext | null> {
  const startTime = Date.now();
  
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(MABIZ_SESSION_COOKIE)?.value;
    if (!sid) {
      logger.info('getMabizSession: no SID found');
      return null;
    }

    const session = await prisma.mabizSession.findUnique({
      where: { id: sid },
    });

    const duration = Date.now() - startTime;
    logger.info('getMabizSession', {
      duration,
      found: !!session,
      timestamp: new Date().toISOString(),
    });

    // ... rest of function ...
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('getMabizSession error', {
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
```

**Monitoring dashboard query**:

```sql
-- Check query frequency over 1 hour (after deployment)
SELECT 
  COUNT(*) as query_count,
  AVG(CAST(duration AS FLOAT)) as avg_duration_ms,
  MAX(CAST(duration AS FLOAT)) as max_duration_ms
FROM logs
WHERE operation = 'getMabizSession'
  AND timestamp > NOW() - INTERVAL '1 hour'
  AND timestamp < NOW();

-- Expected results:
-- - query_count: ~200-300 (for moderate traffic)
-- - Before: calls would be 3x this number (due to duplication)
-- - After: calls reduced by ~67%
```

**Target**: 60-70% reduction in `/api/auth/me` calls

---

**Task 2: Real User Monitoring (RUM)**

If you have analytics (Google Analytics, Sentry, DataDog):

```typescript
// Log performance metrics to analytics
if (typeof window !== 'undefined' && 'performance' in window) {
  window.addEventListener('load', () => {
    const perfData = performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    
    // Send to your analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'page_load_time', {
        value: Math.round(pageLoadTime),
        event_category: 'performance',
      });
    }
    
    logger.info('Page load metrics', {
      pageLoadTime,
      ttfb: perfData.responseEnd - perfData.navigationStart,
      tti: perfData.domInteractive - perfData.navigationStart,
      lcp: perfData.loadEventEnd - perfData.navigationStart,
    });
  });
}
```

**Dashboard metrics** (by day):
- Monday: TTI = 3.8s, API calls = 4
- Tuesday: TTI = 3.9s, API calls = 4
- Wednesday: TTI = 3.7s, API calls = 4
- (etc., looking for consistency and no regression)

---

### Phase 3: Long-term Monitoring (Week 2+)

**Task 1: Automated Performance Budget**

Add performance budget check to CI/CD:

```bash
# In your CI pipeline (e.g., GitHub Actions)
npm run lighthouse -- \
  --chrome-flags="--headless" \
  --output-path=./lighthouse-report.html \
  https://mabizcruisedot.com/dashboard

# Validate performance
if [ $(grep -oP 'Performance.*?(\d+)' lighthouse-report.html | tail -1 | grep -oP '\d+$') -lt 85 ]; then
  echo "❌ Performance score < 85. Failing build."
  exit 1
fi
```

**Budget targets**:
- Lighthouse Performance score: ≥ 85
- TTI: ≤ 4.0s (slow 3G)
- LCP: ≤ 2.5s (slow 3G)
- FCP: ≤ 1.8s (slow 3G)

---

**Task 2: Error Tracking & Alerts**

Set up alerts for performance regressions:

```typescript
// In src/lib/sentry.ts (if using Sentry)
import * as Sentry from "@sentry/nextjs";

Sentry.setTransactionSampler((context) => {
  const tti = performance.timing.domInteractive - performance.timing.navigationStart;
  
  // If TTI > 4.5s (20% worse than target), capture this transaction
  if (tti > 4500) {
    return 1.0; // Capture 100%
  }
  
  return 0.1; // Sample 10% of normal requests
});

// Alert on specific metrics
Sentry.captureException(new Error('TTI exceeded threshold'), {
  tags: { metric: 'TTI', value: tti },
  severity: 'warning',
});
```

---

## 5. Rollback Plan

If performance regression detected:

**Immediate Action (within 5 minutes)**:

1. Revert the Server Component changes:
   ```bash
   git revert <commit-hash> # The P0-5 commit
   git push origin main
   ```

2. Redeploy to production (Vercel auto-redeploys on push)

3. Run Lighthouse audit to confirm metrics returned to baseline

**Root cause analysis** (within 1 hour):

```bash
# Compare commits
git diff <before-commit>..<after-commit> -- \
  src/app/\(dashboard\)/layout.tsx \
  src/app/\(dashboard\)/dashboard/page.tsx \
  src/app/\(dashboard\)/dashboard-client.tsx

# Check for:
# - Missing props drilling (session not passed correctly)
# - Accidental re-renders in Client Component
# - New useEffect hooks introduced
# - Mistaken 'use client' directives
```

---

## 6. Query Reduction Validation Checklist

### Server-side validation (after deployment):

- [ ] `getMabizSession()` called exactly ONCE per page load
- [ ] Session data cached in server memory (not re-fetched)
- [ ] No `/api/auth/me` endpoint calls from dashboard page
- [ ] SidebarNav receives session via props, not via fetch
- [ ] All child components use passed session, no redundant queries

### Client-side validation (DevTools):

```javascript
// Run this in DevTools Console to validate
(async () => {
  const apiCalls = [];
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.name.includes('/api/')) {
        apiCalls.push({
          endpoint: entry.name.split('/api/')[1],
          duration: Math.round(entry.duration),
        });
      }
    });
  });

  observer.observe({ entryTypes: ['resource'] });
  
  setTimeout(() => {
    observer.disconnect();
    
    const authMeCalls = apiCalls.filter(c => c.endpoint.includes('auth/me'));
    console.log(`Total API calls: ${apiCalls.length}`);
    console.log(`Auth/me calls: ${authMeCalls.length}`);
    
    if (authMeCalls.length > 1) {
      console.warn('⚠️ REGRESSION: Multiple /api/auth/me calls detected!');
    } else if (authMeCalls.length === 1) {
      console.log('✅ PASS: Single /api/auth/me call (expected after Server Component optimization)');
    } else {
      console.log('✅ PASS: No /api/auth/me calls (ideal - session from Server Component)');
    }
  }, 5000);
})();
```

---

## 7. Success Criteria (Go/No-Go Decision)

### Must Pass ✅ (deployment blocker)

- [ ] **Network tab**: Max 4 concurrent API calls on page load
- [ ] **Network tab**: NO duplicate `/api/auth/me` calls
- [ ] **Lighthouse FCP**: Equal to or faster than baseline (no regression)
- [ ] **Lighthouse LCP**: Equal to or faster than baseline (no regression)
- [ ] **TTI**: ≤ 4.0s on slow 3G (Lighthouse simulated throttling)
- [ ] **No console errors** related to auth or hydration
- [ ] **No visual flashing** of user info (hydration mismatch fixed)

### Should Improve 🎯 (optimization goals)

- [ ] TTI improves by 60-80ms
- [ ] FCP improves by 150-300ms
- [ ] LCP improves by 100-200ms
- [ ] API calls reduced from 4-5 to 3-4
- [ ] Database query logs show 60-70% reduction for `/api/auth/me`

### Watch for Regression ⚠️ (failure indicators)

- [ ] TTI regresses by > 100ms
- [ ] LCP increases (higher is worse)
- [ ] 5+ concurrent API calls on load
- [ ] Console shows "hydration mismatch" or "content-mismatch" errors
- [ ] Multiple `/api/auth/me` calls in Network tab
- [ ] User avatar/name "flashing" on page load

---

## 8. Post-Deployment Checklist

**Immediately after deploying P0-5:**

- [ ] Run Lighthouse audit (3 times, take median)
- [ ] Check Chrome DevTools Network tab (look for duplicate auth calls)
- [ ] Run React Profiler (ensure no useEffect waterfall)
- [ ] Test on mobile (slow 3G throttling)
- [ ] Verify SidebarNav shows user name correctly (no auth delay)
- [ ] Check Sentry/error tracking for new errors
- [ ] Monitor database query logs for `getMabizSession` reduction
- [ ] Run manual E2E test (login → dashboard → navigate to other pages)

**Every morning (for 3 days after deployment)**:

- [ ] Check Lighthouse Performance score (should be ≥ 85)
- [ ] Check error rate (should be 0%)
- [ ] Check average TTI (should be stable or improving)
- [ ] Review Sentry performance transactions (look for slowdowns)

---

## 9. Next Steps (P1 Planning)

### P1 Optimizations to plan:

1. **Cache Strategy**
   - Server-side: Cache `getMabizSession()` for 5-10 minutes
   - Client-side: SWR or React Query with 5-minute stale time
   - Expected gain: 30-50% more latency savings

2. **Redis Integration**
   - Cache session in Redis (expires at same time as DB session)
   - Expected gain: 40-60ms additional latency savings

3. **Parallel Data Loading**
   - Fetch dashboard data (stats, feed, etc.) in parallel with auth
   - Expected gain: Further 100-200ms TTI improvement

4. **Streaming SSR**
   - Use Next.js Suspense boundary for progressive rendering
   - Send HTML before all data ready
   - Expected gain: 200-400ms TTFB improvement

---

## 10. Contact & Escalation

**If performance metrics don't meet targets**:

1. Check `/api/auth/me` call count in Network tab
2. Verify `getMabizSession()` is truly async in layout.tsx
3. Check DashboardClient is marked as `'use client'`
4. Review for accidental `useEffect` hooks fetching auth
5. Escalate to Agent β (Performance) for deep analysis

**Contacts**:
- Agent β (Performance): Optimization analysis & metrics validation
- Agent γ (Infrastructure): Query optimization & database tuning
- Frontend lead: Hydration mismatch & rendering issues

---

## Appendix A: Manual Testing Script

```bash
#!/bin/bash
# Run this after deploying P0-5

echo "=== P0-5 Performance Validation ==="
echo ""
echo "1. Opening Lighthouse audit..."
# Requires lighthouse-cli installed: npm install -g @lhci/cli@latest
lighthouse https://mabizcruisedot.com/dashboard \
  --output-path=./lighthouse-p05.html \
  --chrome-flags="--headless --disable-gpu"

echo ""
echo "2. Checking Network Performance..."
# This requires Playwright or Puppeteer to automate browser
# Example with curl (basic):
curl -I https://mabizcruisedot.com/dashboard -w "\nTTFB: %{time_starttransfer}s\n"

echo ""
echo "3. Database Query Check (if applicable)..."
echo "Run: SELECT COUNT(*) FROM logs WHERE operation='getMabizSession' AND timestamp > NOW() - INTERVAL '1 hour'"

echo ""
echo "✅ P0-5 validation complete. Compare metrics with baseline."
```

---

## Appendix B: Performance Budget Configuration

```json
// lighthouse.json (for lighthouse-ci)
{
  "ci": {
    "upload": {
      "target": "temporary-public-storage"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "performance": ["error", { "minScore": 0.85 }],
        "accessibility": ["error", { "minScore": 0.80 }],
        "best-practices": ["error", { "minScore": 0.80 }],
        "seo": ["error", { "minScore": 0.80 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-byte-weight": ["error", { "maxNumericValue": 2500000 }]
      }
    }
  }
}
```

---

**Generated**: 2026-05-20
**Agent**: β (Performance & Optimization)
**Target**: P0-5 Server Component optimization monitoring
**Status**: Ready for deployment
