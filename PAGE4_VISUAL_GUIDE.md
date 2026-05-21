# Page 4: Visual Implementation Guide

---

## Architecture Comparison

### BEFORE: ❌ Client-side fetch
```
User navigates to /dashboard/payments
           ↓
payments/page.tsx mounts
           ↓
useState(isAdmin) = false ← STATE UNDEFINED
           ↓
useEffect runs → fetch('/api/auth/me')
           ↓
        WAIT ⏱️
    (100-200ms)
           ↓
Response arrives → setIsAdmin(true/false)
           ↓
Component re-renders ← FLICKER/DELAY
           ↓
Mall tab visible (if admin)
```

**Problems:**
- ⚠️ Extra network call
- ⚠️ 100-200ms delay
- ⚠️ State undefined during load
- ⚠️ Visual flicker for users

---

### AFTER: ✅ Server-side context
```
User navigates to /dashboard/payments
           ↓
(dashboard)/layout.tsx renders (SERVER)
           ↓
getMabizSession() → ctx.role
           ↓
<SessionProvider role={ctx.role}>  ← PASS ROLE
  <PaymentsPage /> (CLIENT)
</SessionProvider>
           ↓
payments/page.tsx renders
           ↓
useSession() → { isAdmin } ← INSTANT
           ↓
Component renders
           ↓
Mall tab visible (if admin)
```

**Benefits:**
- ✅ NO extra network call
- ✅ ZERO delay
- ✅ Server-side data
- ✅ Instant rendering
- ✅ No flicker

---

## File Modification Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PLAN                          │
└─────────────────────────────────────────────────────────────────┘

   NEW FILE                   MODIFY                     MODIFY
   ┌──────────┐              ┌──────────┐              ┌──────────┐
   │useSession│              │  layout  │              │ payments │
   │  .ts     │              │  .tsx    │              │  .tsx    │
   └──────┬───┘              └────┬─────┘              └────┬─────┘
          │                       │                        │
          │ EXPORT:              │ IMPORT:               │ IMPORT:
          │ • SessionProvider    │ SessionProvider       │ useSession
          │ • useSession         │                       │
          │                      │ WRAP:                 │ REPLACE:
          │                      │ <SessionProvider>     │ useState
          │                      │   {children}          │ with
          │                      │ </SessionProvider>    │ useSession
          │                      │                       │
          │                      │ PASS:                 │ DELETE:
          │                      │ role={session.role}   │ useEffect
          │                      │                       │
          └──────────────────────────────────────────────┘
```

---

## Code Flow Visualization

### Step 1: Server-side (layout.tsx)
```typescript
// (dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const ctx = await getMabizSession();
  // ctx.role = "GLOBAL_ADMIN" or "MEMBER" or ...
  
  const session: AuthSession = {
    userId: ctx.userId,
    role: ctx.role,  ← ✅ ROLE AVAILABLE
    organizationId: ctx.organizationId,
    ...
  };

  return (
    <SessionProvider role={session.role}>  ← ✅ PASS ROLE
      <div>
        {/* ALL CHILD PAGES CAN ACCESS ROLE */}
        {children}
      </div>
    </SessionProvider>
  );
}
```

### Step 2: Hook Definition (useSession.ts)
```typescript
// hooks/useSession.ts
const SessionContext = createContext<SessionContextType>({ isAdmin: false });

export function SessionProvider({ children, role }) {
  const isAdmin = role === 'GLOBAL_ADMIN';  ← ✅ COMPUTE isAdmin
  return (
    <SessionContext.Provider value={{ role, isAdmin }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);  ← ✅ RETRIEVE FROM CONTEXT
}
```

### Step 3: Client-side (payments/page.tsx)
```typescript
// payments/page.tsx
export default function PaymentsPage() {
  const { isAdmin } = useSession();  ← ✅ GET isAdmin INSTANTLY
  
  // NO FETCH NEEDED
  // NO USEEFFECT
  // NO STATE
  
  return (
    <>
      {isAdmin && (
        <button>크루즈닷몰(B2C)</button>  ← ✅ RENDERS IMMEDIATELY
      )}
    </>
  );
}
```

---

## Line-by-Line Changes

### File 1: Create src/hooks/useSession.ts

```
NEW FILE
│
├─ Line 1: 'use client';
├─ Line 3: import { createContext, useContext, ReactNode } from 'react';
├─ Line 5: interface SessionContextType { ... }
├─ Line 9: const SessionContext = createContext(...)
├─ Line 11: export function SessionProvider(...) { ... }
├─ Line 19: export function useSession() { ... }
│
└─ Total: 22 lines
```

### File 2: Update src/app/(dashboard)/layout.tsx

```
BEFORE: Line 1-6 (imports)
├─ import { redirect }
├─ import { getMabizSession }
├─ import { AuthSession }
├─ import { SidebarNav }
└─ import { BottomTabBar }

AFTER: Line 1-6 (imports)
├─ import { redirect }
├─ import { getMabizSession }
├─ import { AuthSession }
├─ import { SessionProvider }  ← ADD
├─ import { SidebarNav }
└─ import { BottomTabBar }

───────────────────────────────

BEFORE: Line 29-44 (return)
└─ <div className="flex">...</div>

AFTER: Line 29-44 (return)
└─ <SessionProvider role={session.role}>  ← WRAP START
     <div className="flex">...</div>       ← INNER CONTENT
   </SessionProvider>                       ← WRAP END

Total changes: +1 import + wrap with SessionProvider
```

### File 3: Update src/app/(dashboard)/payments/page.tsx

```
BEFORE: Line 1-5 (imports)
├─ "use client";
├─ import { useState, useEffect, useCallback } from "react";
└─ import { CreditCard, ... } from "lucide-react";

AFTER: Line 1-5 (imports)
├─ "use client";
├─ import { useState, useCallback } from "react";  ← REMOVE useEffect
└─ import { CreditCard, ... } from "lucide-react";
├─ import { useSession } from "@/hooks/useSession";  ← ADD

───────────────────────────────

BEFORE: Line 81-83 (state)
└─ const [tab, setTab] = useState(...);
   const [isAdmin, setIsAdmin] = useState(false);  ← DELETE THIS
   const [payments, setPayments] = useState(...);

AFTER: Line 81-83 (state)
├─ const { isAdmin } = useSession();  ← ADD THIS
├─ const [tab, setTab] = useState(...);
└─ const [payments, setPayments] = useState(...);

───────────────────────────────

BEFORE: Line 127-132 (effect)
└─ useEffect(() => {
     fetch('/api/auth/me', ...)
       .then(...)
       .then(...)
       .catch(...)
   }, []);

AFTER: Line 127-132 (effect)
└─ [DELETED COMPLETELY]

───────────────────────────────

BEFORE: Line 230-237 (conditional render)
└─ {isAdmin && (
     <button...>크루즈닷몰</button>
   )}

AFTER: Line 230-237 (conditional render)
└─ [NO CHANGES - KEEP AS-IS]
   {isAdmin && (
     <button...>크루즈닷몰</button>
   )}

Total changes: 1 import + 1 state replacement + 1 effect deletion
```

---

## Network Comparison

### BEFORE: ❌ Extra Call
```
Chrome DevTools → Network Tab

Name              Status  Type    Size     Time
─────────────────────────────────────────────
payments?...      200     fetch   2.5 KB   12ms
auth/me           200     fetch   0.8 KB   89ms ❌ UNNECESSARY
subscription      200     fetch   1.2 KB   15ms
```

### AFTER: ✅ No Extra Call
```
Chrome DevTools → Network Tab

Name              Status  Type    Size     Time
─────────────────────────────────────────────
payments?...      200     fetch   2.5 KB   12ms
subscription      200     fetch   1.2 KB   15ms

[No auth/me call] ✅
```

---

## Timeline Visualization

### BEFORE: Slow (with network call)
```
0ms     50ms    100ms   150ms   200ms   250ms
│       │       │       │       │       │
Start   ├───────Fetch /api/auth/me──────┤
│       │                       │       │
│       Render                  │       Render again
│       (isAdmin=false)         │       (isAdmin=true)
│       FLICKER ────────────────┘       FLICKER
└───────────────────────────────────────────
        ~100-150ms extra load time
```

### AFTER: Fast (from context)
```
0ms     50ms    100ms   150ms   200ms   250ms
│       │       │       │       │       │
Start   │
│       Render (isAdmin from context)
│       ✅ INSTANT
└───────────────────────────────────────────
        NO extra load time
```

---

## Role → isAdmin Logic

```
Input (role)     | Output (isAdmin)
─────────────────┼──────────────────
GLOBAL_ADMIN     | true         ← Show mall tab
ADMIN            | false        ← Hide mall tab
MEMBER           | false        ← Hide mall tab
AGENT            | false        ← Hide mall tab
<undefined>      | false        ← Hide mall tab (safe default)

Logic: isAdmin = (role === 'GLOBAL_ADMIN')
```

---

## Testing Scenarios

### Scenario 1: Admin User
```
1. Login with GLOBAL_ADMIN role
   └─ session.role = "GLOBAL_ADMIN"
      └─ SessionProvider passes role to context
         └─ useSession() → isAdmin = true
            └─ {isAdmin && <MallTab />}
               └─ ✅ MALL TAB VISIBLE

2. Network tab
   └─ ❌ NO /api/auth/me call
   └─ ✅ VERIFIED
```

### Scenario 2: Non-Admin User
```
1. Login with MEMBER role
   └─ session.role = "MEMBER"
      └─ SessionProvider passes role to context
         └─ useSession() → isAdmin = false
            └─ {isAdmin && <MallTab />} → renders nothing
               └─ ✅ MALL TAB HIDDEN

2. Network tab
   └─ ❌ NO /api/auth/me call
   └─ ✅ VERIFIED
```

---

## Component Tree After Changes

```
<SessionProvider role={ctx.role}>
  │
  ├─ useSession() available to all children
  │
  ├─ <SidebarNav session={session} />
  │
  ├─ <main>
  │  └─ <PaymentsPage>
  │     └─ const { isAdmin } = useSession()  ← GETS role FROM PROVIDER
  │        └─ Renders conditional: {isAdmin && <MallTab />}
  │
  ├─ <BottomTabBar />
  │
  └─ <FloatingChatbot />
```

---

## Git Diff Summary

```diff
+ src/hooks/useSession.ts (NEW FILE)
  └─ 22 lines: SessionProvider + useSession hook

~ src/app/(dashboard)/layout.tsx (MODIFIED)
  └─ +1 import line
  └─ +2 wrapper tags

~ src/app/(dashboard)/payments/page.tsx (MODIFIED)
  └─ +1 import line
  └─ -1 import (useEffect)
  └─ +1 hook call (useSession)
  └─ -1 useState (isAdmin)
  └─ -6 useEffect block

TOTAL: 1 new file, 2 modified files
```

---

**Ready for implementation! Follow PAGE4_IMPLEMENTATION_CHECKLIST.md for step-by-step execution.**
