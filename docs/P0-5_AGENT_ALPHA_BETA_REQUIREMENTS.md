# P0-5 Server Component - Requirements for Agents α & β
## Backend & API Team Responsibilities for QA Testing

**Document Date**: 2026-05-20  
**Prepared by**: Agent γ (QA)  
**Audience**: Agent α (Backend), Agent β (API/Performance)  
**Purpose**: Clarify implementation requirements for QA to validate  

---

## Agent α: Backend/Server Component Implementation

### Your Role
You are responsible for implementing the **Server Component authentication** that eliminates redundant `/api/auth/me` client-side calls by passing session data as props during server-side rendering.

### QA Requirements from Agent α

#### Requirement 1: getSession() in Layout.tsx
**What**: Implement server-side `getSession()` in root layout  
**Why**: QA needs to verify auth data is fetched server-side (not client)  
**How**: 
```typescript
// ✅ REQUIRED PATTERN:
// src/app/layout.tsx (or root layout component)

import { getSession } from 'next-auth/react';

export default async function RootLayout({ children }) {
  const session = await getSession();
  
  return (
    <html>
      <body>
        <Layout session={session}>
          {children}
        </Layout>
      </body>
    </html>
  );
}
```

**QA Test**: 
- Test P0.1 checks that `session` object is available in props
- QA will verify no `/api/auth/me` call is made

---

#### Requirement 2: Session Props Passed to All Children
**What**: Ensure `session` prop is passed from Layout → Components → Nested Components  
**Why**: Session data must be available everywhere without client-side fetch  
**How**:
```typescript
// ✅ REQUIRED PATTERN:
// src/app/layout.tsx
export default async function Layout({ session, children }) {
  return (
    <Header session={session} />  // ← Pass it down
    <Sidebar session={session} />
    <main>{children}</main>
  );
}

// src/components/Header.tsx
export default function Header({ session }: { session: Session | null }) {
  if (!session) return <div>Not logged in</div>;
  return <span>{session.user.name}</span>;
}
```

**QA Test**:
- Test P0.3 verifies session data is available at leaf components
- QA checks console for "Cannot read property of undefined" errors

---

#### Requirement 3: TypeScript Types - Strict Validation
**What**: All `session` props must be properly typed (no `any`)  
**Why**: QA runs TypeScript build to verify no type errors  
**How**:
```typescript
// ✅ REQUIRED:
interface LayoutProps {
  session: Session | null;  // ← Explicit type, not any
  children: React.ReactNode;
}

export default function Layout(props: LayoutProps) {
  // ...
}

// ❌ DO NOT DO:
interface LayoutProps {
  session: any;  // ← Bad: allows undefined access
  children: any;
}
```

**QA Test**:
- Test P0.2 runs `npm run build` and checks for 0 TypeScript errors
- **BLOCKER**: Any TypeScript error = STOP deployment

---

#### Requirement 4: No Client-Side Session Fetch
**What**: Remove all `useEffect` hooks that call `/api/auth/me`  
**Why**: QA monitors network tab for auth calls (should be 0)  
**How**:
```typescript
// ❌ OLD PATTERN (DO NOT USE):
export default function Dashboard() {
  const [session, setSession] = useState(null);
  
  useEffect(() => {
    // ← THIS IS THE CALL QA WANTS ELIMINATED
    fetch('/api/auth/me').then(r => r.json()).then(setSession);
  }, []);
}

// ✅ NEW PATTERN (USE THIS):
export default function Dashboard({ session }: { session: Session | null }) {
  // Session already available as prop, no fetch needed
  return <span>{session?.user?.name}</span>;
}
```

**QA Test**:
- Test P3.1 specifically checks Network tab for `/api/auth/me` calls
- **BLOCKER**: If any /api/auth/me call detected = STOP deployment

---

#### Requirement 5: Session Validation & Sanitization
**What**: Ensure session data is validated before passing to props  
**Why**: QA tests XSS & data integrity (P0.3, P4.1, P4.2)  
**How**:
```typescript
// ✅ REQUIRED: Validate before using
export default async function Layout({ children }) {
  const session = await getSession();
  
  // Validate required fields exist
  if (session) {
    const valid = 
      typeof session.user?.id === 'string' &&
      typeof session.user?.email === 'string' &&
      session.expires && new Date(session.expires) > new Date();
    
    if (!valid) {
      // Clear invalid session
      return <Redirect to="/login" />;
    }
  }
  
  return <Layout session={session}>{children}</Layout>;
}
```

**QA Test**:
- Test P0.3 verifies session data integrity
- Test P4.2 verifies XSS payloads are escaped
- Test P2.4 verifies UI handles missing fields gracefully

---

#### Requirement 6: Error Handling for Missing Session
**What**: Handle case where `getSession()` returns null or undefined  
**Why**: QA tests P2 error scenarios (missing cookies, expired sessions)  
**How**:
```typescript
// ✅ REQUIRED: Handle null session
export default async function Layout({ children }) {
  const session = await getSession();
  
  if (!session) {
    // Option A: Show login page
    return <Redirect to="/login" />;
    
    // Option B: Show content with null-safe checks
    // Use optional chaining: session?.user?.name
  }
  
  return <Layout session={session}>{children}</Layout>;
}

// ✅ In components: Handle null gracefully
export default function Header({ session }: { session: Session | null }) {
  return <span>{session?.user?.name || 'Guest'}</span>;
}
```

**QA Test**:
- Test P2.1, P2.2, P2.3 all verify graceful error handling
- No blank white pages or undefined text

---

#### Requirement 7: Session Expiration Handling
**What**: Check if session.expires is in future (not expired)  
**Why**: QA tests P2.1 (expired session handling)  
**How**:
```typescript
// ✅ REQUIRED: Check expiration
export default async function Layout({ children }) {
  const session = await getSession();
  
  if (session && new Date(session.expires) < new Date()) {
    // Session expired, clear it
    await signOut({ redirect: true });
  }
  
  return <Layout session={session}>{children}</Layout>;
}
```

**QA Test**:
- Test P2.1 manipulates cookies to simulate expiration
- Verifies user is redirected to login (not error page)

---

#### Requirement 8: Console Warnings & Logs
**What**: Remove console.error/warn for missing session (or use debug only)  
**Why**: QA checks console for errors during test P0.4 and P1.1  
**How**:
```typescript
// ✅ REQUIRED: Only log in development
if (process.env.NODE_ENV === 'development') {
  console.debug('[Auth] Session loaded:', session?.user?.id);
}

// ❌ DO NOT DO:
console.error('Session is null'); // Pollutes console in production
```

**QA Test**:
- Test P1.1 opens DevTools Console and checks for 0 red errors
- **BLOCKER**: Any console.error = test fails

---

### Agent α Checklist (Before QA Testing)

- [ ] `getSession()` implemented in root layout.tsx
- [ ] Session passed as props to all child components
- [ ] All session props typed (no `any`, use `Session | null`)
- [ ] Removed all `useEffect` → `fetch('/api/auth/me')` patterns
- [ ] Session data validated before rendering
- [ ] Null session handled gracefully (redirect or optional chaining)
- [ ] Expired session detected and handled
- [ ] No console.error spam for auth issues
- [ ] TypeScript build succeeds (`npm run build` exit 0)
- [ ] Layout component is a Server Component (async function)

**QA Sign-Off Required**: ✅ All 10 items complete before testing starts

---

## Agent β: API & Performance Optimization

### Your Role
You are responsible for ensuring the Server Component approach **improves performance** by eliminating redundant API calls and optimizing data loading.

### QA Requirements from Agent β

#### Requirement 1: Eliminate N+1 Query in getSession()
**What**: Optimize `getSession()` to fetch user data in single query (not N+1)  
**Why**: QA measures performance (P3.1, P3.2) - extra queries slow down TTI  
**How**:
```typescript
// ❌ BAD: N+1 Query
const session = await getSession();  // Query 1: Session
const user = await db.user.findUnique({ ... });  // Query 2: User
const org = await db.organization.findUnique({ ... });  // Query 3: Org

// ✅ GOOD: Single Query or Joined Query
const sessionWithData = await db.session.findUnique({
  where: { id: sessionId },
  include: {
    user: {
      include: {
        organization: true,
      },
    },
  },
});
```

**QA Test**:
- Test P3.1 monitors network calls and their timing
- Measures total time from request to response
- **Target**: Session fetch < 200ms (including all includes)

---

#### Requirement 2: Cache getSession() Response
**What**: Cache session data on server (5-minute TTL minimum)  
**Why**: QA tests performance with Lighthouse (P3.2)  
**How**:
```typescript
// ✅ REQUIRED: Add caching layer
import { cache } from 'react';

const getSessionCached = cache(async () => {
  // This will be cached within a single request
  // Multiple components can call it without re-fetching
  return await getSession();
});

// In layout:
const session = await getSessionCached();
```

**QA Test**:
- Test P3.1 checks that multiple concurrent requests don't duplicate fetch
- Measures network waterfall to verify caching works

---

#### Requirement 3: Verify No Redundant /api/auth/me Call
**What**: After implementing Server Components, `/api/auth/me` endpoint should NOT be called during initial page load  
**Why**: QA checks Network tab specifically for this call (P3.1)  
**How**:
```typescript
// ✅ REQUIRED: If you have /api/auth/me endpoint, it should:
// Option A: Not be called at all (preferred)
// Option B: Be called only as fallback (after server-side attempt fails)

// ❌ DO NOT DO: Call it on every page load from client
export default function Page() {
  useEffect(() => {
    fetch('/api/auth/me');  // ← This defeats the purpose
  }, []);
}
```

**QA Test**:
- Test P3.1 explicitly checks Network tab for 0 /api/auth/me calls
- **BLOCKER**: If endpoint is called = STOP deployment

---

#### Requirement 4: Database Indexing for Session Lookups
**What**: Ensure database indexes exist on session lookup fields  
**Why**: QA measures performance - slow DB queries = slow TTI  
**How**:
```sql
-- ✅ REQUIRED: Create indexes for session lookup
CREATE INDEX idx_session_id ON "Session"(id);
CREATE INDEX idx_session_userId ON "Session"("userId");
CREATE INDEX idx_session_expires ON "Session"(expires);

-- ✅ Optional but helpful: Composite index
CREATE INDEX idx_session_lookup ON "Session"(id, "expires");
```

**QA Test**:
- Test P3.2 runs Lighthouse and measures TTI
- **Target**: TTI < 3.0 seconds (improvement vs before)

---

#### Requirement 5: Query Response Time < 200ms
**What**: Session query should return in < 200ms (including database round trip)  
**Why**: QA measures performance (P3.1 Network waterfall)  
**How**:
```typescript
// ✅ REQUIRED: Log query time
const startTime = Date.now();
const session = await getSession();
const queryTime = Date.now() - startTime;

if (queryTime > 200) {
  console.warn(`[PERF] Session query took ${queryTime}ms`);
}
```

**QA Test**:
- Test P3.1 checks Network tab Duration column
- Queries visible as XHR requests should show < 200ms
- **Target**: 90% of requests < 200ms (P99 < 500ms)

---

#### Requirement 6: Slow Network Handling
**What**: Session loading should work on Slow 3G (50kb/s) without timeout  
**Why**: QA tests P3.3 (slow network scenario)  
**How**:
```typescript
// ✅ REQUIRED: Implement reasonable timeout
const getSessionWithTimeout = async () => {
  return Promise.race([
    getSession(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    ),
  ]).catch(() => null);  // Return null on timeout
};
```

**QA Test**:
- Test P3.3 enables DevTools Network throttling: "Slow 3G"
- Loads page and verifies:
  - No blank screen
  - Content loads progressively
  - Total load < 8 seconds

---

#### Requirement 7: No Blocking CSS/JS
**What**: Session loading should not block render (use React Suspense if needed)  
**Why**: QA measures First Contentful Paint (FCP) and Largest Contentful Paint (LCP)  
**How**:
```typescript
// ✅ REQUIRED: Non-blocking auth
// Session is available but doesn't block initial render
export default async function Layout({ children }) {
  const session = await getSession();  // Server-side, before HTML
  
  return (
    <html>
      <body>
        {/* This renders immediately with or without session */}
        {children}
        {/* Session-dependent content can be in Suspense boundary */}
        <Suspense fallback={<Skeleton />}>
          <AuthGuard session={session} />
        </Suspense>
      </body>
    </html>
  );
}
```

**QA Test**:
- Test P3.2 Lighthouse report measures FCP/LCP
- **Target**: FCP < 1.8s, LCP < 2.5s

---

#### Requirement 8: Rate Limiting on Session Endpoint
**What**: If keeping `/api/auth/me` as fallback, implement rate limiting  
**Why**: QA test P2.3 (server error scenario) needs graceful degradation  
**How**:
```typescript
// ✅ REQUIRED: Rate limit /api/auth/me endpoint
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),  // 100 requests/minute
});

export async function GET(request: Request) {
  const { success } = await ratelimit.limit(request.ip);
  
  if (!success) {
    return new Response('Rate limited', { status: 429 });
  }
  
  const session = await getSession();
  return Response.json(session);
}
```

**QA Test**:
- Test P2.3 simulates server error
- Verifies graceful fallback behavior

---

#### Requirement 9: Monitoring & Metrics
**What**: Expose metrics for session loading performance  
**Why**: QA needs to verify improvement vs baseline  
**How**:
```typescript
// ✅ REQUIRED: Track performance
import { metrics } from '@app/metrics';

const getSessionMetricsWrapped = async () => {
  const start = Date.now();
  const session = await getSession();
  const duration = Date.now() - start;
  
  metrics.histogram('auth.session.fetch.duration', duration, {
    status: session ? 'success' : 'null',
  });
  
  return session;
};
```

**QA Test**:
- QA monitors metrics dashboard during 24-hour post-deployment
- Verifies TTI improvement of 10-20%

---

#### Requirement 10: Baseline Metrics Before Deployment
**What**: Provide before/after comparison for these metrics  
**Why**: QA validates performance improvement claims  
**How**:
```
BEFORE (with /api/auth/me on client):
  - Network calls: 5 (HTML + CSS + JS + /api/auth/me + others)
  - Time to auth visible: 1600ms
  - TTI: 3.2s
  - Lighthouse Score: 88

AFTER (with Server Component props):
  - Network calls: 4 (HTML + CSS + JS + others, no /api/auth/me)
  - Time to auth visible: 1200ms (400ms improvement)
  - TTI: 2.8s (400ms improvement)
  - Lighthouse Score: 92

Improvement: ~12% faster load time
```

**QA Test**:
- Test P3.1 compares network calls count
- Test P3.2 Lighthouse compares scores
- **Target**: Improvement of 10-20%

---

### Agent β Checklist (Before QA Testing)

- [ ] N+1 query in getSession() eliminated (single optimized query)
- [ ] Server-side caching implemented (5+ minute TTL)
- [ ] /api/auth/me call removed from initial page load
- [ ] Database indexes created for session lookups
- [ ] Session query response time < 200ms (tested locally)
- [ ] Slow 3G scenario tested (works without timeout)
- [ ] Non-blocking render (CSS/JS doesn't wait for session)
- [ ] Rate limiting implemented on fallback endpoints
- [ ] Metrics/monitoring exposed for performance tracking
- [ ] Before/after baseline metrics documented

**QA Sign-Off Required**: ✅ All 10 items complete before testing starts

---

## Shared Responsibilities (α + β)

### Code Review Checklist
Before submitting to QA, both agents should verify:

- [ ] **TypeScript**: `npm run build` succeeds with 0 errors
- [ ] **Linting**: `npm run lint` shows 0 errors
- [ ] **Tests**: `npm run test` shows no new failures
- [ ] **Performance**: No console warnings about deprecated APIs
- [ ] **Security**: No `dangerouslySetInnerHTML` without escaping
- [ ] **Comments**: Code has JSDoc comments explaining auth flow

### QA Collaboration
When QA finds issues:

1. **QA reports failure** with evidence:
   ```
   Test P0.1 FAILED:
   - Expected: 0 /api/auth/me calls
   - Actual: 1 /api/auth/me call detected
   - Network screenshot attached
   ```

2. **Agent α or β responds** with root cause:
   ```
   Root Cause: Layout.tsx not using getSession()
   Fix: Updating src/app/layout.tsx to:
     const session = await getSession();
     return <Layout session={session}>{children}</Layout>;
   ```

3. **Fix is tested locally**:
   ```
   Fixed in commit abc123def
   npm run build ✅
   npm run test ✅
   Ready for QA re-test
   ```

4. **QA re-tests** to verify fix

---

## Emergency Contact During Deployment

**If QA encounters blocking issues**:

### Agent α Issues (Backend Auth)
- /api/auth/me still being called
- TypeScript errors in build
- Console errors about undefined session
- Session data not passed to components

**Contact Agent α**: Priority CRITICAL (blocks deployment)

### Agent β Issues (API Performance)
- TTI regression (>20% slower)
- Network waterfall shows blocked operations
- Query response > 500ms
- Slow 3G timeout

**Contact Agent β**: Priority HIGH (blocks deployment)

### Unclear Issues
- Test failure doesn't clearly point to α or β
- Need architecture consultation
- Need database query optimization

**Contact**: Tech Lead + both agents

---

## Success Criteria (Agent α + β perspective)

### Agent α: "Auth is Implemented"
```
✅ getSession() works server-side
✅ Session passed as props to components
✅ TypeScript build succeeds
✅ No client-side /api/auth/me calls
✅ Error handling is graceful
✅ Console shows 0 auth-related errors
```

### Agent β: "Performance is Optimized"
```
✅ Network calls reduced by 1 (200ms saved)
✅ TTI improved by 10-20%
✅ Query response < 200ms
✅ Lighthouse score >= 90
✅ Slow 3G scenario works
✅ Monitoring metrics show improvement
```

### Combined: "Ready for Production"
```
✅ All P0-5 QA tests pass
✅ Deployment checklist signed off
✅ 24-hour monitoring plan in place
✅ Rollback procedure ready
✅ Team briefing completed
```

---

## FAQ for Agents α & β

### Q: What if we find a bug in QA's test?
**A**: Great question! If you believe a test is wrong:
1. Document the issue in a comment on the test
2. Discuss with Agent γ (QA)
3. If agreed: Update the test and re-run
4. Never skip a test - fix the test or the code

### Q: What if we can't eliminate /api/auth/me completely?
**A**: Acceptable workarounds:
- Keep endpoint for fallback only (when getSession() fails)
- Ensure it's not called on normal happy path
- QA will verify it's not in the Network waterfall during successful login

### Q: How do we test locally before QA testing?
**A**: Use the same tools QA uses:
```bash
# TypeScript validation
npm run build

# Network monitoring
# DevTools → Network tab, hard refresh, login
# Look for /api/auth/me (should not appear)

# Performance
npx lighthouse http://localhost:3000

# Console errors
# DevTools → Console, verify 0 red errors
```

### Q: What if TTI doesn't improve by 10%?
**A**: Investigate:
- Are there other bottlenecks besides /api/auth/me?
- Is database query still slow (> 200ms)?
- Are there blocking CSS/JavaScript?
- Consider further optimizations:
  - Database indexing
  - Query caching layer (Redis)
  - CSS/JS code splitting
  - Image optimization

### Q: When should we start testing?
**A**: Timeline:
- **Today (Day -1)**: Review this document
- **Tomorrow (Day 0)**: Implementation & local testing
- **Day +1**: QA testing begins (after checklist complete)
- **Day +2**: Deployment & monitoring

---

## Document for α & β Reference

**Keep this document handy during implementation**:
- Print § "QA Requirements from Agent [α/β]"
- Check off each item as completed
- Have it ready when QA testing begins
- Reference during 24-hour monitoring

---

**Ready to implement with confidence? You've got this!** ✅

**Questions?** Refer to main QA checklist or contact Agent γ (QA)

---

**Last Updated**: 2026-05-20  
**For**: Menu #38 Phase 4 / Server Component Auth  
**Prepared by**: Agent γ (QA)
