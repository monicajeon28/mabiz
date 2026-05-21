# Page 4: Quick Reference - Remove /api/auth/me

## 3-File Changes Summary

### 1️⃣ CREATE: `src/hooks/useSession.ts`
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

---

### 2️⃣ UPDATE: `src/app/(dashboard)/layout.tsx`

**Line 1-6: Add import**
```typescript
import { SessionProvider } from "@/hooks/useSession";  // ← ADD
```

**Line 29-37: Wrap with SessionProvider**
```typescript
return (
  <SessionProvider role={session.role}>  // ← WRAP HERE
    <div className="flex h-screen bg-[#F7F8FC]">
      <SidebarNav className="hidden md:flex" session={session} />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>
      <BottomTabBar className="md:hidden" />
      <FloatingChatbot />
    </div>
  </SessionProvider>  // ← CLOSE PROVIDER
);
```

---

### 3️⃣ UPDATE: `src/app/(dashboard)/payments/page.tsx`

**Line 1-5: Update imports**
```typescript
"use client";

import { useState, useCallback } from "react";  // ← REMOVE useEffect
import { CreditCard, RefreshCw, ArrowUpRight, ArrowDownLeft, Clock, Repeat, Store } from "lucide-react";
import { useSession } from "@/hooks/useSession";  // ← ADD
```

**Line 81-82: Replace state with hook**
```typescript
export default function PaymentsPage() {
  const { isAdmin } = useSession();  // ← ADD (replaces useState(false))
  const [tab, setTab] = useState<"payments" | "mall" | "subscriptions">("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
```

**Line 127-132: DELETE useEffect entirely**
```typescript
// REMOVE THESE LINES:
// useEffect(() => {
//   fetch('/api/auth/me', { credentials: 'include' })
//     .then((r) => r.json())
//     .then((d) => { if (d.ok && d.role === 'GLOBAL_ADMIN') setIsAdmin(true); })
//     .catch(() => {});
// }, []);
```

**Line 230-237: Keep AS-IS (no changes needed)**
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

---

## What Changed?

| Aspect | Before | After |
|--------|--------|-------|
| **isAdmin source** | State + fetch call | Context hook |
| **Network calls** | 1x /api/auth/me | 0x |
| **Load time** | +100-200ms | Instant |
| **Flicker** | Yes (state undefined) | No (instant from server) |
| **Code in payments.tsx** | 8 lines (useState + useEffect) | 1 line (useSession) |

---

## Test Checklist

- [ ] No `/api/auth/me` in DevTools Network tab
- [ ] Admin sees "크루즈닷몰(B2C)" tab immediately
- [ ] Non-admin does NOT see it
- [ ] Mall tab loads correctly when clicked
- [ ] All other page features work (search, filter, refund)

---

## Rollback (if needed)

Simply revert these 3 files to restore `/api/auth/me` call:
```bash
git checkout HEAD~1 src/hooks/useSession.ts
git checkout HEAD~1 src/app/\(dashboard\)/layout.tsx
git checkout HEAD~1 src/app/\(dashboard\)/payments/page.tsx
```

---

## Implementation Time: 8 minutes max
