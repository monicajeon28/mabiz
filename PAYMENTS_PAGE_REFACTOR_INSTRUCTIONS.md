# Page 4: Remove /api/auth/me from payments/page.tsx

**Agent:** β
**Duration:** 8 minutes
**Risk Level:** Low-Medium (context setup + prop passing)
**Deadline:** ASAP

---

## Problem Statement

File: `src/app/(dashboard)/payments/page.tsx`

**Current Issue:**
- Line 128-132: useEffect calls `/api/auth/me` to fetch session and set `isAdmin` flag
- Used conditionally at line 230-237 to show/hide mall (B2C) tab
- Adds unnecessary network call to a page that already has server-side session data available

**Why It's a Problem:**
1. Network overhead: Extra fetch call on every page mount
2. Race condition: `isAdmin` state is undefined until fetch completes, causing tab to flicker
3. Duplication: Dashboard layout already has `session` with `role` available

**Solution:**
Use SessionContext provider to pass `role` from server to client component (OPTION B - recommended)

---

## Architecture Overview

### Current Flow (❌ Before)
```
payments/page.tsx (client)
  ├─ useState(isAdmin) = false
  └─ useEffect → fetch(/api/auth/me)
      └─ Network call ❌
```

### New Flow (✅ After)
```
(dashboard)/layout.tsx (server)
  ├─ getMabizSession() → ctx.role
  └─ <SessionProvider role={ctx.role}>
      └─ <payments/page.tsx> (client)
          └─ useSession() → { isAdmin } ✅
```

---

## Step-by-Step Implementation

### **STEP 1: Create SessionContext Hook** (2 minutes)

**File:** `src/hooks/useSession.ts` (NEW)

**Code:**
```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';

interface SessionContextType {
  role?: string;
  isAdmin: boolean;
}

const SessionContext = createContext<SessionContextType>({ isAdmin: false });

export function SessionProvider({ children, role }: { children: ReactNode; role?: string }) {
  const isAdmin = role === 'GLOBAL_ADMIN';
  
  return (
    <SessionContext.Provider value={{ role, isAdmin }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  return useContext(SessionContext);
}
```

**Key Points:**
- Export both `SessionProvider` (for layout.tsx) and `useSession()` hook (for payments/page.tsx)
- Compute `isAdmin` from `role` prop (no state needed)
- Default `isAdmin: false` if role not provided
- Keep role optional to support fallback scenarios

---

### **STEP 2: Update Dashboard Layout** (3 minutes)

**File:** `src/app/(dashboard)/layout.tsx`

**Changes:**

**A. Add import at top (line 1-6):**
```typescript
import { redirect } from "next/navigation";
import { getMabizSession } from "@/lib/auth";
import { AuthSession } from "@/types/auth";
import { SessionProvider } from "@/hooks/useSession";  // ← ADD THIS LINE
import { SidebarNav } from "@/components/layout/SidebarNav";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { FloatingChatbot } from "@/components/layout/FloatingChatbot";
```

**B. Wrap children with SessionProvider (line 29-37):**

**BEFORE:**
```tsx
  return (
    <div className="flex h-screen bg-[#F7F8FC]">
      {/* PC: 좌측 사이드바 */}
      <SidebarNav className="hidden md:flex" session={session} />

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
```

**AFTER:**
```tsx
  return (
    <SessionProvider role={session.role}>
      <div className="flex h-screen bg-[#F7F8FC]">
        {/* PC: 좌측 사이드바 */}
        <SidebarNav className="hidden md:flex" session={session} />

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* 모바일: 하단 탭 */}
        <BottomTabBar className="md:hidden" />

        {/* 플로팅 세일즈봇 */}
        <FloatingChatbot />
      </div>
    </SessionProvider>
  );
```

**Why:**
- `session.role` already computed server-side from `getMabizSession()`
- Provider wraps entire dashboard tree → all children can access via `useSession()`
- No additional network calls

---

### **STEP 3: Update Payments Page** (2 minutes)

**File:** `src/app/(dashboard)/payments/page.tsx`

**A. Update imports (line 1-5):**

**BEFORE:**
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditCard, RefreshCw, ArrowUpRight, ArrowDownLeft, Clock, Repeat, Store } from "lucide-react";
```

**AFTER:**
```typescript
"use client";

import { useState, useCallback } from "react";  // ← REMOVE useEffect
import { CreditCard, RefreshCw, ArrowUpRight, ArrowDownLeft, Clock, Repeat, Store } from "lucide-react";
import { useSession } from "@/hooks/useSession";  // ← ADD THIS LINE
```

**B. Remove state declaration and add hook (line 81-82):**

**BEFORE:**
```typescript
export default function PaymentsPage() {
  const [tab, setTab] = useState<"payments" | "mall" | "subscriptions">("payments");
  const [isAdmin, setIsAdmin] = useState(false);  // ← DELETE THIS LINE
  const [payments, setPayments] = useState<Payment[]>([]);
```

**AFTER:**
```typescript
export default function PaymentsPage() {
  const { isAdmin } = useSession();  // ← ADD THIS LINE
  const [tab, setTab] = useState<"payments" | "mall" | "subscriptions">("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
```

**C. Delete useEffect (line 127-132):**

**DELETE THESE LINES COMPLETELY:**
```typescript
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.role === 'GLOBAL_ADMIN') setIsAdmin(true); })
      .catch(() => {});
  }, []);
```

**D. Keep conditional render as-is (line 230-237):**
```typescript
        {isAdmin && (
          <button
            onClick={() => setTab("mall")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "mall" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Store className="w-4 h-4 inline mr-1.5" />크루즈닷몰(B2C)
          </button>
        )}
```

**Why:**
- `useSession()` hook now provides `isAdmin` from server context
- No state needed → no race condition
- Tab shows immediately without flicker

---

## Testing Checklist

### **Test 1: Verify SessionProvider works**
```bash
# 1. Open DevTools → Network tab
# 2. Navigate to /dashboard/payments
# 3. Confirm NO `/api/auth/me` request in network log ✓
```

### **Test 2: Admin role functionality**
```bash
# 1. Login as GLOBAL_ADMIN user
# 2. Verify "크루즈닷몰(B2C)" tab visible immediately (no flicker) ✓
# 3. Click tab → should load mall payments ✓
```

### **Test 3: Non-admin role functionality**
```bash
# 1. Login as non-admin user (e.g., MEMBER)
# 2. Verify "크루즈닷몰(B2C)" tab hidden ✓
# 3. Only "결제 내역" and "정기결제" tabs visible ✓
```

### **Test 4: Page functionality still works**
```bash
# 1. Admin user: All 3 tabs work (payments, mall, subscriptions) ✓
# 2. Non-admin user: 2 tabs work (payments, subscriptions) ✓
# 3. Search, filter, pagination work as before ✓
# 4. Refund modal works ✓
```

---

## Verification Commands

**Before commit:**
```bash
# Check for any remaining /api/auth/me references in payments page
grep -n "api/auth/me" src/app/\(dashboard\)/payments/page.tsx
# Expected: No results

# Check for remaining useEffect imports (can still be used elsewhere)
grep -n "useEffect" src/app/\(dashboard\)/payments/page.tsx
# Expected: No "useEffect" (removed from imports and usage)

# Check useSession hook is properly used
grep -n "useSession" src/app/\(dashboard\)/payments/page.tsx
# Expected: 1 import + 1 usage = 2 results
```

---

## Risk Assessment

### **Low Risk:**
✓ SessionProvider is a simple context wrapper
✓ Only affects payments page (no cascading changes)
✓ `role` data already available in layout.tsx

### **Medium Risk:**
⚠ If other dashboard pages also use `/api/auth/me`, they'll need similar refactoring
⚠ Context pattern must be consistent across dashboard

### **Mitigation:**
- Test on both admin and non-admin accounts
- Verify no other pages are affected (check git diff after)
- Keep `/api/auth/me` endpoint if other apps use it

---

## Files to Modify

| File | Action | Lines |
|------|--------|-------|
| `src/hooks/useSession.ts` | CREATE | - |
| `src/app/(dashboard)/layout.tsx` | MODIFY | 1-6 (import), 29-37 (wrap) |
| `src/app/(dashboard)/payments/page.tsx` | MODIFY | 1-5 (imports), 81-82 (state), 127-132 (delete effect) |

---

## Git Commit Message

```
refactor(payments): Remove /api/auth/me call, use SessionContext instead

- Create SessionProvider hook to pass role from server
- Update dashboard layout to wrap children with SessionProvider
- Remove useEffect + /api/auth/me fetch from payments page
- isAdmin now computed from server-side session role

Benefits:
- Eliminates unnecessary network call
- Removes race condition (no more state flicker)
- Improves page load time
- Consistent with Next.js 13+ patterns

Test:
- Admin tab shows/hides based on GLOBAL_ADMIN role
- No /api/auth/me in network tab
```

---

## Timeline

| Step | Task | Duration |
|------|------|----------|
| 1 | Create useSession.ts hook | 2 min |
| 2 | Update layout.tsx imports & wrap | 2 min |
| 3 | Update payments page.tsx | 2 min |
| 4 | Test admin/non-admin flows | 2 min |
| **TOTAL** | | **8 min** |

---

## Common Pitfalls to Avoid

❌ **Don't:** Remove the entire useEffect line without checking dependencies
✅ **Do:** Delete lines 127-132 exactly as shown

❌ **Don't:** Put SessionProvider in payments/page.tsx directly
✅ **Do:** Put it in (dashboard)/layout.tsx to wrap entire dashboard

❌ **Don't:** Forget to update imports in payments/page.tsx
✅ **Do:** Add `import { useSession }` and remove `useEffect`

❌ **Don't:** Pass `session` object to SessionProvider
✅ **Do:** Pass only `role` prop: `<SessionProvider role={session.role}>`

---

## Post-Implementation

### If test passes:
```bash
git add .
git commit -m "refactor(payments): Remove /api/auth/me call..."
git log --oneline -1
# Confirm commit shows all 3 files changed
```

### If test fails:
- Check browser console for errors
- Verify SessionProvider is wrapped correctly in layout
- Confirm `role` prop is being passed (add `console.log('role:', role)` in hook)
- Check that useSession is imported from correct path

---

**Status:** Ready for implementation
**Owner:** Agent β
**Priority:** P0 (blocking other refactors)
