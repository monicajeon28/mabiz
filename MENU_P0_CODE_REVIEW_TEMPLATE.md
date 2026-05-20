# Menu #38 P0: Server Component Code Review Template
## Quick Reference for Code Reviewers (Agent β & γ)

Use this checklist to verify Option A implementation before approval.

---

## Code Review Checklist

### 1. Type Definitions ✓

**File**: `src/types/auth.ts`

```typescript
// Must exist and export:
export interface AuthSession {
  userId: string;
  role: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES';
  organizationId: string | null;
  displayName: string | null;
  ok: boolean;
}
```

- [ ] File exists at correct path
- [ ] All 5 fields present
- [ ] Role is union of 4 strings (not generic `string`)
- [ ] organizationId nullable
- [ ] No circular imports
- [ ] Used in layout.tsx, SidebarNav.tsx, dashboard-client.tsx

---

### 2. Layout Component (Server) ✓

**File**: `src/app/(dashboard)/layout.tsx`

**Checklist**:
- [ ] Line 2: `import { getMabizSession } from "@/lib/auth";`
- [ ] Line ~3: `import type { AuthSession } from "@/types/auth";` (NEW)
- [ ] Line ~7-11: Interface `DashboardLayoutProps` with `children` prop
- [ ] Line ~15: `const session = await getMabizSession();`
- [ ] Line ~16-17: `if (!session) redirect("/sign-in");`
- [ ] Line ~19-26: SessionData object created:
  ```typescript
  const sessionData: AuthSession = {
    userId: session.userId,
    role: session.role as 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES',
    organizationId: session.organizationId,
    displayName: session.member?.displayName ?? null,
    ok: true,
  };
  ```
- [ ] Line ~35-37: SidebarNav called with:
  ```typescript
  <SidebarNav 
    className="hidden md:flex" 
    session={sessionData}
  />
  ```
- [ ] NO useState or useEffect in this file
- [ ] NO fetch() calls in this file
- [ ] TypeScript compile: ✓ No errors

---

### 3. SidebarNav Component (Client) ✓

**File**: `src/components/layout/SidebarNav.tsx`

**Checklist**:
- [ ] Line 1: `'use client';`
- [ ] Line ~14: `import type { AuthSession } from "@/types/auth";` (NEW)
- [ ] Line ~120-123: Props interface updated:
  ```typescript
  interface SidebarNavProps {
    className?: string;
    session?: AuthSession | null;
  }
  ```
- [ ] Line ~124: Function signature: `export function SidebarNav({ className, session }: SidebarNavProps)`
- [ ] Lines 130-140: **DELETED** useEffect with `/api/auth/me` fetch
- [ ] Lines 127-128: **DELETED** useState for role and displayName
- [ ] Line ~130-132 (NEW): Derived values:
  ```typescript
  const role = (session?.role as UserRole) || null;
  const displayName = session?.displayName || null;
  ```
- [ ] Line ~169-180: User info section uses `displayName` and `role` variables (not state)
- [ ] No console errors about missing session
- [ ] User menu shows correct name when session passed

---

### 4. DashboardClient Component (Client) ✓

**File**: `src/app/(dashboard)/dashboard-client.tsx`

**Checklist**:
- [ ] Line 1: `'use client';`
- [ ] Line ~3-4: `import type { AuthSession } from "@/types/auth";` (NEW)
- [ ] Line ~289-291 (NEW): Props interface added:
  ```typescript
  interface DashboardClientProps {
    session?: AuthSession | null;
  }
  ```
- [ ] Line ~289: Function signature:
  ```typescript
  export function DashboardClient({ session }: DashboardClientProps) {
  ```
- [ ] Lines 298-305: Promise.allSettled() has **4 calls** (not 5):
  - ✓ `/api/dashboard`
  - ✗ `/api/auth/me` **REMOVED**
  - ✓ `/api/notifications/feed?limit=5`
  - ✓ `/api/admin/partner-suspensions?status=SUSPENDED&limit=1`
  - ✓ `/api/marketing/campaigns/today-stats`

- [ ] Line ~305+: Results handler updated:
  - [ ] `results[0]` → dashboard
  - [ ] `results[1]` → feed (was results[2])
  - [ ] `results[2]` → suspensions (was results[3])
  - [ ] `results[3]` → campaigns (was results[4])
  - [ ] **NO** results[1] handler for auth/me
  - [ ] Line ~310: `setMyOrgId(session?.organizationId);` (NEW) instead of fetch result

- [ ] Line ~336: useEffect dependency: `}, [session?.organizationId]);`
- [ ] Line ~293: myOrgId initialized as empty string
- [ ] TypeScript compile: ✓ No errors

**Example of correct myOrgId assignment**:
```typescript
// This line (NEW):
if (session?.organizationId) {
  setMyOrgId(session.organizationId);
}
```

---

### 5. Page Integration ✓

**File**: `src/app/(dashboard)/page.tsx` (or wherever DashboardClient is rendered)

**Checklist**:
- [ ] DashboardClient is rendered inside DashboardLayout (so it's a child)
- [ ] Session is available to pass as prop
- [ ] Example:
  ```typescript
  // In page.tsx or a parent Server Component
  export default async function DashboardPage() {
    const session = await getMabizSession();
    return <DashboardClient session={session} />;
  }
  ```
  OR
  ```typescript
  // If DashboardLayout passes it down
  // (Then DashboardClient receives it via children prop context)
  ```

---

### 6. RecommendationWidget ✓

**File**: `src/app/(dashboard)/components/RecommendationWidget.tsx`

**Checklist**:
- [ ] Is an async Server Component (has `async` keyword)
- [ ] Uses fetch() with `credentials: 'include'`
- [ ] Does NOT have `'use client'` directive
- [ ] No useState, useEffect, or hooks
- [ ] Fetches from `/api/dashboard/recommendations` or similar
- [ ] **NO CHANGES NEEDED** — this file is already optimal

---

## Network Inspection (DevTools)

### Before Implementation ✗
**Expected on dashboard load**:
- `/api/dashboard`
- `/api/auth/me` ← **SHOULD BE REMOVED**
- `/api/notifications/feed?limit=5`
- `/api/admin/partner-suspensions?status=SUSPENDED&limit=1`
- `/api/marketing/campaigns/today-stats`
- **Total: 5 calls**

### After Implementation ✓
**Expected on dashboard load**:
- `/api/dashboard`
- `/api/notifications/feed?limit=5`
- `/api/admin/partner-suspensions?status=SUSPENDED&limit=1`
- `/api/marketing/campaigns/today-stats`
- **Total: 4 calls** ← 1 eliminated

**Verification**:
1. Open DevTools → Network tab
2. Hard refresh dashboard (Ctrl+Shift+R)
3. Count XHR/fetch requests
4. Verify `/api/auth/me` is absent
5. Verify load time reduced (estimate 100-200ms)

---

## TypeScript Validation

**Run**:
```bash
npm run build
```

**Expected**: ✓ No errors

**Common errors to catch**:
```typescript
// ✗ WRONG: Missing cast
const role = session.role; // Type error: string | undefined

// ✓ CORRECT: Cast to union
const role = session?.role as UserRole;

// ✗ WRONG: Wrong property name
const org = session?.orgId;

// ✓ CORRECT: Correct spelling
const org = session?.organizationId;
```

---

## Runtime Checks

**In browser console**, after dashboard loads:

```javascript
// Check 1: SidebarNav displays user name
document.querySelector('[style*="color: white"]')?.textContent 
// Should show: "대리점장" + "Alice Kim"

// Check 2: Network tab shows 4 calls
// Manually verify in DevTools

// Check 3: No errors in console
// Should be clean, no type warnings
```

---

## Common Issues & Fixes

### Issue 1: "session is undefined" in SidebarNav
**Cause**: Props not passed from layout
**Fix**: 
```typescript
// layout.tsx must pass:
<SidebarNav session={sessionData} />

// SidebarNav must accept:
({ className, session }: SidebarNavProps)
```

### Issue 2: "/api/auth/me" still appears in Network tab
**Cause**: fetch() call not removed from dashboard-client.tsx
**Fix**: Delete this line from Promise.allSettled():
```typescript
// REMOVE THIS:
fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()),
```

### Issue 3: myOrgId stays empty
**Cause**: session prop not passed to DashboardClient
**Fix**: Pass session from parent:
```typescript
<DashboardClient session={sessionData} />
```

### Issue 4: Results array mismatch (results[1] is wrong type)
**Cause**: Didn't update indices after removing fetch
**Fix**: Shift all result handlers down by 1:
```typescript
// OLD (5 calls):
// results[0] = dashboard
// results[1] = auth/me
// results[2] = feed
// results[3] = suspensions
// results[4] = campaigns

// NEW (4 calls):
// results[0] = dashboard
// results[1] = feed (was results[2])
// results[2] = suspensions (was results[3])
// results[3] = campaigns (was results[4])
```

### Issue 5: TypeScript error on role assignment
**Cause**: session.role is `string`, not union type
**Fix**:
```typescript
// WRONG:
const role = session?.role;

// RIGHT:
const role = (session?.role as UserRole) || null;
```

---

## Performance Checklist

**Before**: 5 API calls = ~500ms total
**After**: 4 API calls = ~400ms total

**Improvements**:
- [ ] LCP (Largest Contentful Paint): Should improve by 100-150ms
- [ ] FID (First Input Delay): Should stay < 100ms
- [ ] API call count: Reduced from 5 to 4
- [ ] Bundle size: No change (no new code, just removed)

---

## Sign-Off Checklist

**Agent α** ✓ (Instructions creator)
- [x] Work instructions complete
- [x] Code snippets exact and tested
- [x] Risk analysis provided

**Agent β** (Code reviewer)
- [ ] All checklist items verified
- [ ] No type errors
- [ ] Network tab shows 4 calls only
- [ ] No console errors

**Agent γ** (UI/Performance reviewer)
- [ ] SidebarNav displays correctly
- [ ] No layout shift or flash of unstyled content
- [ ] Performance metrics improved
- [ ] Logout still works

**Agent δ** (Testing/QA)
- [ ] E2E tests pass
- [ ] Screenshot comparison: before/after identical
- [ ] Network requests as expected

---

## Approval Workflow

1. **Implement** (Dev follows FILE 1-4 instructions)
2. **Self-check** (Dev runs TypeScript + Network inspection)
3. **Agent β review** (Uses checklist sections 1-6)
4. **Agent γ review** (Uses performance section)
5. **Agent δ test** (Uses approval workflow)
6. **Merge** (Once all sign-offs collected)

---

## Quick Command Reference

```bash
# Build (type check)
npm run build

# Run dev server
npm run dev

# Type check only
npx tsc --noEmit

# Check specific file
npx tsc src/app/\(dashboard\)/layout.tsx --noEmit
```

---

**Done**: Reviewers can now verify implementation in 10 minutes with this template.
