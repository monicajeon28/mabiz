# Menu #38 P0-5: Server Component Optimization (Option A)
## Detailed Work Instructions — P0 Essential Phase

**Approach**: Move `/api/auth/me` from client-side `useEffect` to server-side data passing

**Goal**: Eliminate redundant client-side auth fetch calls, improve Core Web Vitals (LCP, FID), reduce API pressure

**Timeline**: Wave 1-3 = 45 min total

---

## Wave 1: Type Definitions (10 min)

### FILE 0: src/types/auth.ts (CREATE NEW)

**Purpose**: Centralized auth types used across server + client components

**Status**: Does not exist yet — CREATE

**Exact code to add**:
```typescript
// src/types/auth.ts
export interface AuthSession {
  userId: string;
  role: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES';
  organizationId: string | null;
  displayName: string | null;
  ok: boolean;
}

export interface MallUser {
  id: number;
  name: string | null;
  mallUserId: string | null;
  affiliateType: string | null;
  affiliateProfileId: number | null;
}

export interface MabizAuthContext extends AuthSession {
  mallUser?: MallUser;
  member: {
    id: string;
    organizationId: string;
    role: string;
    displayName: string | null;
  } | null;
}
```

**Why**: Server and client need consistent type contracts. Prevents prop-type mismatch errors.

---

## Wave 2: Server-Side Data Passing (15 min)

### FILE 1: src/app/(dashboard)/layout.tsx

**Current state** (lines 1-34):
- Imports `getMabizSession()` from `@/lib/auth`
- Calls `getMabizSession()` once (GOOD)
- Renders `<SidebarNav />` without props (PROBLEM)
- Renders `{children}` without context (PROBLEM)

**Changes needed**:

#### Step 1.1: Add props type definition
**Location**: After imports, before the component

**Add**:
```typescript
interface DashboardLayoutProps {
  children: React.ReactNode;
}
```

#### Step 1.2: Extract session data + pass to SidebarNav
**Location**: Inside DashboardLayout function, after redirect check

**BEFORE** (lines 18-20):
```typescript
  return (
    <div className="flex h-screen bg-[#F7F8FC]">
      {/* PC: 좌측 사이드바 */}
      <SidebarNav className="hidden md:flex" />
```

**AFTER**:
```typescript
  // Extract session data for props
  const sessionData: AuthSession = {
    userId: session.userId,
    role: session.role as 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES',
    organizationId: session.organizationId,
    displayName: session.member?.displayName ?? null,
    ok: true,
  };

  return (
    <div className="flex h-screen bg-[#F7F8FC]">
      {/* PC: 좌측 사이드바 */}
      <SidebarNav 
        className="hidden md:flex" 
        session={sessionData}
      />
```

**Why**: SidebarNav will now receive session as prop instead of fetching independently. Eliminates 1 redundant fetch.

#### Step 1.3: Add import
**Location**: Top of file, after existing imports

**Add**:
```typescript
import type { AuthSession } from "@/types/auth";
```

**Final layout.tsx structure**:
```typescript
import { redirect } from "next/navigation";
import { getMabizSession } from "@/lib/auth";
import type { AuthSession } from "@/types/auth";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { FloatingChatbot } from "@/components/layout/FloatingChatbot";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await getMabizSession();
  if (!session) {
    redirect("/sign-in");
  }

  // Extract session data for props
  const sessionData: AuthSession = {
    userId: session.userId,
    role: session.role as 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES',
    organizationId: session.organizationId,
    displayName: session.member?.displayName ?? null,
    ok: true,
  };

  return (
    <div className="flex h-screen bg-[#F7F8FC]">
      {/* PC: 좌측 사이드바 */}
      <SidebarNav 
        className="hidden md:flex" 
        session={sessionData}
      />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* 모바일: 하단 탭 */}
      <BottomTabBar className="md:hidden" />

      {/* 플로팅 세일즈봇 */}
      <FloatingChatbot />
    </div>
  );
}
```

---

### FILE 2: src/components/layout/SidebarNav.tsx

**Current state** (lines 1-293):
- `useEffect` (lines 130-140) fetches `/api/auth/me` independently — REDUNDANT
- Lines 127-128: Uses local state for `role` and `displayName`

**Changes needed**:

#### Step 2.1: Update props interface
**Location**: Lines 120-122

**BEFORE**:
```typescript
interface SidebarNavProps {
  className?: string;
}
```

**AFTER**:
```typescript
import type { AuthSession } from "@/types/auth";

interface SidebarNavProps {
  className?: string;
  session?: AuthSession | null;
}
```

**Why**: Accept session as prop instead of fetching

#### Step 2.2: Add import at top
**Location**: Line 1 (after `"use client"`)

**Add**:
```typescript
import type { AuthSession } from "@/types/auth";
```

#### Step 2.3: Remove useEffect + fetch call
**Location**: Lines 130-140

**DELETE**:
```typescript
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setRole(d.role);
          setDisplayName(d.displayName);
        }
      })
      .catch(() => {});
  }, []);
```

**Replace with**:
```typescript
  // Get role & displayName from server-passed session prop
  const role = (session?.role as UserRole) || null;
  const displayName = session?.displayName || null;
```

**Why**: Use prop instead of state + fetch. Eliminates one API call.

#### Step 2.4: Remove state declarations
**Location**: Lines 127-128

**BEFORE**:
```typescript
  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
```

**AFTER**: Delete these lines entirely (no longer needed)

**Final updated component function signature**:
```typescript
export function SidebarNav({ className, session }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Get role & displayName from server-passed session prop
  const role = (session?.role as UserRole) || null;
  const displayName = session?.displayName || null;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/sign-in');
  }

  const isFreeSales = role === "FREE_SALES";
  
  // ... rest of component stays the same
```

**Why**: Clean, efficient, no redundant fetches.

---

## Wave 3: Client Component Optimization (20 min)

### FILE 3: src/app/(dashboard)/dashboard-client.tsx

**Current state** (lines 298-336):
- `useEffect` calls `Promise.allSettled()` with 5 API calls
- **Line 301**: Fetches `/api/auth/me` — THIS IS REDUNDANT
- **Lines 310-311**: Sets `myOrgId` from fetch response

**Problem**: This fetch is redundant because:
1. Server already fetched session in `layout.tsx`
2. `organizationId` can be passed as prop from server
3. Client doesn't need to re-verify auth (server already did)

**Changes needed**:

#### Step 3.1: Add props interface
**Location**: Before `DashboardClient` function (around line 289)

**Add**:
```typescript
interface DashboardClientProps {
  session?: AuthSession | null;
}
```

#### Step 3.2: Add import
**Location**: Top of file (after `'use client'`)

**Add**:
```typescript
import type { AuthSession } from "@/types/auth";
```

#### Step 3.3: Update function signature
**Location**: Line 289

**BEFORE**:
```typescript
export function DashboardClient() {
```

**AFTER**:
```typescript
export function DashboardClient({ session }: DashboardClientProps) {
```

#### Step 3.4: Update Promise.allSettled() call
**Location**: Lines 298-305

**BEFORE**:
```typescript
  useEffect(() => {
    Promise.allSettled([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()),
      fetch('/api/notifications/feed?limit=5').then(r => r.json()),
      fetch('/api/admin/partner-suspensions?status=SUSPENDED&limit=1').then(r => r.json()),
      fetch('/api/marketing/campaigns/today-stats').then(r => r.json()),
    ]).then(results => {
```

**AFTER**:
```typescript
  useEffect(() => {
    Promise.allSettled([
      fetch("/api/dashboard").then((r) => r.json()),
      // REMOVED: fetch("/api/auth/me") — now passed as prop from server
      fetch('/api/notifications/feed?limit=5').then(r => r.json()),
      fetch('/api/admin/partner-suspensions?status=SUSPENDED&limit=1').then(r => r.json()),
      fetch('/api/marketing/campaigns/today-stats').then(r => r.json()),
    ]).then(results => {
```

**Why**: Server already fetched auth. No need to fetch again client-side.

#### Step 3.5: Update results handler
**Location**: Lines 305-335

**BEFORE**:
```typescript
    ]).then(results => {
      if (results[0].status === 'fulfilled' && results[0].value?.ok) {
        setData(results[0].value);
      }

      if (results[1].status === 'fulfilled' && results[1].value?.ok && results[1].value?.organizationId) {
        setMyOrgId(results[1].value.organizationId);
      }

      if (results[2].status === 'fulfilled' && results[2].value?.ok) {
        setFeed(results[2].value.items ?? []);
      } else if (results[2].status === 'rejected') {
        console.error('알림 피드 로드 실패:', results[2].reason);
      }

      if (results[3].status === 'fulfilled' && results[3].value?.ok) {
        setSuspendedPartnerCount(results[3].value.data.total ?? 0);
      }

      if (results[4].status === 'fulfilled' && results[4].value?.ok) {
        const campaignStats = results[4].value;
        setData(prev => prev ? {
          ...prev,
          campaignScheduledToday: campaignStats.scheduledToday ?? 0,
          campaignInProgress: campaignStats.inProgress ?? 0,
          campaignCompletedToday: campaignStats.completedToday ?? 0,
        } : prev);
      }

      setFeedLoading(false);
    });
```

**AFTER**:
```typescript
    ]).then(results => {
      if (results[0].status === 'fulfilled' && results[0].value?.ok) {
        setData(results[0].value);
      }

      // Set myOrgId from server-passed session prop instead of fetch
      if (session?.organizationId) {
        setMyOrgId(session.organizationId);
      }

      if (results[1].status === 'fulfilled' && results[1].value?.ok) {
        setFeed(results[1].value.items ?? []);
      } else if (results[1].status === 'rejected') {
        console.error('알림 피드 로드 실패:', results[1].reason);
      }

      if (results[2].status === 'fulfilled' && results[2].value?.ok) {
        setSuspendedPartnerCount(results[2].value.data.total ?? 0);
      }

      if (results[3].status === 'fulfilled' && results[3].value?.ok) {
        const campaignStats = results[3].value;
        setData(prev => prev ? {
          ...prev,
          campaignScheduledToday: campaignStats.scheduledToday ?? 0,
          campaignInProgress: campaignStats.inProgress ?? 0,
          campaignCompletedToday: campaignStats.completedToday ?? 0,
        } : prev);
      }

      setFeedLoading(false);
    });
```

**Why**: Use `session?.organizationId` from prop. Results array indices shift down by 1 (was 5, now 4).

#### Step 3.6: Add dependency tracking
**Location**: Line 336

**BEFORE**:
```typescript
  }, []);
```

**AFTER**:
```typescript
  }, [session?.organizationId]); // Re-run if organizationId from server changes
```

**Why**: Track dependency on session data; safer React pattern.

#### Step 3.7: Update initial state setter
**Location**: Line 293

**Consider**: If `session` prop exists on mount, you can optionally pre-set `myOrgId` earlier:

**Optional optimization** (add after state declarations):
```typescript
  // Pre-set myOrgId from server session if available
  useEffect(() => {
    if (session?.organizationId && !myOrgId) {
      setMyOrgId(session.organizationId);
    }
  }, [session?.organizationId, myOrgId]);
```

**Why**: Avoids race condition where myOrgId is empty until fetch completes (already have it server-side).

---

### FILE 4: src/app/(dashboard)/components/RecommendationWidget.tsx

**Current state** (lines 1-50 visible):
- Already an async Server Component
- Fetches `/api/dashboard/recommendations` via cookies (httpOnly, secure)

**Changes needed**: NONE — This component is already correct.

**Why**:
- Uses server-side fetch with httpOnly cookies (credentials: 'include')
- Not a useEffect client fetch — already server-rendered
- No redundancy

**Verification**: Check that this file:
- Has `async` keyword
- Uses `fetch(...credentials: 'include')`
- Does NOT call `useEffect` or `useState`

---

## Implementation Order (Execution Steps)

### STEP 1: Create auth types file (2 min)
```bash
# Create file at D:\mabiz-crm\src\types\auth.ts
# Copy content from "Wave 1: FILE 0" above
```

### STEP 2: Update layout.tsx (5 min)
1. Add import: `import type { AuthSession } from "@/types/auth";`
2. Add interface `DashboardLayoutProps`
3. Extract session data
4. Pass `session={sessionData}` to `<SidebarNav />`

### STEP 3: Update SidebarNav.tsx (5 min)
1. Add import: `import type { AuthSession } from "@/types/auth";`
2. Update props interface to accept `session?: AuthSession | null`
3. REMOVE: useEffect fetch call (lines 130-140)
4. REMOVE: state declarations (lines 127-128)
5. REPLACE: `const role = session?.role || null; const displayName = session?.displayName || null;`

### STEP 4: Update dashboard-client.tsx (5 min)
1. Add import: `import type { AuthSession } from "@/types/auth";`
2. Add props interface
3. Update function signature
4. REMOVE: `/api/auth/me` from Promise.allSettled()
5. REMOVE: results[1] handler that sets myOrgId from fetch
6. REPLACE: `setMyOrgId(session?.organizationId)` directly from prop
7. Update results array indices (shift down by 1)
8. Add dependency: `[session?.organizationId]` to useEffect

### STEP 5: Verify DashboardClient integration in page.tsx (3 min)
**Location**: `src/app/(dashboard)/page.tsx`
- Find where `<DashboardClient />` is rendered
- Pass session from parent component (if parent has access)

---

## Verification Checklist (For Code Review)

**layout.tsx**:
- [ ] `getMabizSession()` called exactly once in server component
- [ ] `AuthSession` type imported from `@/types/auth`
- [ ] `sessionData` constructed with all required fields
- [ ] `<SidebarNav session={sessionData} />` passes prop
- [ ] No `useState` or `useEffect` in layout.tsx

**SidebarNav.tsx**:
- [ ] Props interface updated: `session?: AuthSession | null`
- [ ] useEffect fetch removed completely
- [ ] State declarations (`setRole`, `setDisplayName`) removed
- [ ] `role` and `displayName` derived from `session?.role` and `session?.displayName`
- [ ] Fallback to `null` if session not provided
- [ ] User menu displays correct name/org from prop

**dashboard-client.tsx**:
- [ ] `/api/auth/me` removed from Promise.allSettled()
- [ ] Function signature: `export function DashboardClient({ session }: DashboardClientProps)`
- [ ] `myOrgId` set from `session?.organizationId` instead of fetch response
- [ ] Results array indices adjusted (4 calls, not 5)
- [ ] Dependency array includes `session?.organizationId`
- [ ] TypeScript: No type errors

**Network tab**:
- [ ] Only 4 API calls on dashboard mount: `/api/dashboard`, `/api/notifications/feed`, `/api/admin/partner-suspensions`, `/api/marketing/campaigns/today-stats`
- [ ] **NO** `/api/auth/me` call
- [ ] **NO** redundant fetches

**Browser behavior**:
- [ ] Dashboard loads without blank/loading state
- [ ] User name displays immediately (no flash)
- [ ] Org ID available for link generation on first paint
- [ ] Logout still works (POST to `/api/auth/logout`)

---

## Risks & Mitigations

### Risk 1: Session stale during long session
**Problem**: User's permissions change server-side, client still has old data
**Mitigation (P1)**: Add 5-min heartbeat check via `useEffect` dependency timer

### Risk 2: Prop undefined on mount
**Problem**: `session` prop not passed = SidebarNav shows no user info
**Mitigation**: Add default fallback: `session?.displayName ?? "Unknown User"`

### Risk 3: Type mismatch
**Problem**: MabizAuthContext has 'OWNER' as string, needs enum cast
**Mitigation**: Cast in layout.tsx: `role: session.role as 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES'`

---

## Files Modified Summary

| File | Lines | Change | Impact |
|------|-------|--------|--------|
| `src/types/auth.ts` | +30 | CREATE | New type contract |
| `src/app/(dashboard)/layout.tsx` | +7, +3 | EDIT | Pass session prop |
| `src/components/layout/SidebarNav.tsx` | +2, -15 | EDIT | Remove fetch, use prop |
| `src/app/(dashboard)/dashboard-client.tsx` | +2, -1, +3 | EDIT | Remove fetch, use prop |
| `src/app/(dashboard)/components/RecommendationWidget.tsx` | 0 | NONE | Already correct |

**Total changes**: 4 files, ~40 lines net (mostly deletions of redundant fetch code)

---

## Testing Checklist (After Implementation)

**Unit Test**:
- [ ] SidebarNav renders with session prop
- [ ] SidebarNav shows correct displayName
- [ ] DashboardClient sets myOrgId from prop

**Integration Test**:
- [ ] Open dashboard as OWNER role
- [ ] Check Network tab — only 4 API calls
- [ ] Check user name in sidebar — matches session
- [ ] Check org landing link — uses myOrgId from prop

**Browser Console**:
- [ ] No type errors
- [ ] No prop warnings
- [ ] No hydration mismatch

**Performance**:
- [ ] LCP < 2.5s (improved by eliminating extra fetch)
- [ ] FID < 100ms (faster UI render)
- [ ] No N+1 queries

---

## Deployment Notes

**Before push**:
1. Run `npm run build` — must pass TypeScript
2. Run test suite — must pass
3. Visual regression on `/dashboard` — must match current screenshot

**After merge**:
1. Monitor Vercel deployment — watch for hydration errors
2. Check DataDog APM — verify `/api/auth/me` call count dropped
3. Alert on any auth-related errors in Sentry

---

**Next Steps**: 
- Agent β: API optimization (batch queries)
- Agent γ: UI polish (loading states)
- Agent δ: E2E tests (Playwright)

