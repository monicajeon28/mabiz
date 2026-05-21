# P2 Wave 2: Parallel Execution Diagram

**Date:** 2026-05-21  
**Purpose:** Visual guide for parallel execution  
**Reference:** AGENT_DELTA_P2_WAVE2_MASTER_CHECKLIST.md

---

## Execution Timeline (Optimized)

```
TIMELINE            AGENT δ             AGENT A             AGENT B             AGENT C
0 ──────────────────────────────────────────────────────────────────────────────────────
   |
   PHASE 1: Preparation (5 min)
   ├─ npm run build baseline
   ├─ verify files exist
   ├─ network baseline
   └─ all agents ready
5  |
   │  PHASE 2A: PARALLEL EXECUTION (Page 4 + Page 5)
   ├────────────────────────────────────────────────────────────────────────────────────
   │                                   ┌─ Page 4: Create hook + layout + page
   │                                   │  Time: 8 min
   │                                   │  Files: 3 (1 new + 2 mod)
   │                                   │
   │         ┌─────────────────────────┤  Page 5: Update middleware + delete + new layout
   │         │                         │  Time: 10 min
   │         │                         │  Files: 3 (1 new + 2 mod)
   │         │                         │
   │         │                    ┌────┴─ Both run PARALLEL
   │         │                    │   (different files = safe)
   │         │                    │
   │         │                    │
   │         │                    ├─ T+0: Agent B starts Page 4
   │         │                    ├─ T+0: Agent C starts Page 5
8  │         │                    │
   │         │                    ├─ T+4: Agent B creates useSession.ts ✓
   │         │                    │
   │         │                    ├─ T+6: Agent B updates layout.tsx ✓
   │         │                    │   ↓
   │         │                    │   ⚠️ CHECKPOINT: layout.tsx ready
   │         │                    │   Page 3 can now start
   │         │                    │
   │         │                    ├─ T+8: Agent B updates payments/page.tsx ✓
   │         │                    │        Agent B: COMPLETE
   │         │                    │
   │         │                    ├─ T+9: Agent C completes contracts/templates/page.tsx ✓
   │         │                    │
10 │         │                    ├─ T+10: Agent C completes contracts/layout.tsx ✓
   │         │                           Agent C: COMPLETE
   │         │
   │  PHASE 2B: SEQUENTIAL EXECUTION (Page 3)
   │  ├─ Page 3: Delete lines + use new hook
   │  │  Start time: T+8 (after layout.tsx ready)
   │  │  Time: 2 min
   │  │  Files: 1 (modifications only)
   │  │
   │  └─ DEPENDENCY: Must wait for layout.tsx from Agent B ✓
   │
12 │         └─ T+10: Agent A starts Page 3 (but can start at T+8)
   │                  Agent A: COMPLETE at T+12 (or T+10 if earlier)
   │
   │  PHASE 3: VERIFICATION (15 min)
   ├────────────────────────────────────────────────────────────────────────────────────
   │         ├─ npm run build ✓
   │         ├─ Network tab: 0 /api/auth/me calls ✓
   │         ├─ Functional tests (6 scenarios)
   │         └─ Code review (diff validation)
25 │         └─ ALL TESTS PASS ✓
   │
   │  PHASE 4: GIT COMMIT (5 min)
   ├────────────────────────────────────────────────────────────────────────────────────
   │         ├─ git add (7 files)
   │         ├─ git commit -m "..."
   │         └─ git log verification
30 │         └─ ✅ COMPLETE
   │
   └────────────────────────────────────────────────────────────────────────────────────

TOTAL: 40 minutes (parallel optimized)
If sequential: 5 + 2 + 8 + 10 + 15 + 5 = 45 minutes
Savings: 5 minutes through parallelization
```

---

## Dependency Graph

```
┌──────────────────────────────────────────────────────────────┐
│                      PHASE 1: PREP                           │
│                    All agents waiting                         │
│                    (5 minutes)                                │
└────────────────────────┬─────────────────────────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
        ┌───────▼────────┐  ┌────▼───────────┐
        │    Page 4       │  │    Page 5      │
        │   (Agent B)     │  │   (Agent C)    │
        │                │  │                │
        │ Create hook    │  │ Middleware +   │
        │ Update layout  │  │ Contracts      │
        │ Update page    │  │ New layout     │
        │                │  │                │
        │  8 minutes     │  │  10 minutes    │
        │ (parallel)     │  │ (parallel)     │
        │                │  │                │
        └────────┬───────┘  └────┬───────────┘
                 │                 │
                 │  T+8: layout.tsx ready
                 │                 │
        ┌────────▼─────────────────┘
        │
        │ Creates dependency:
        │ layout.tsx ← Page 4
        │      ▼
        │    Page 3 can start
        │
        ├───────────────┐
        │               │
        │   ┌───────────▼────────┐
        │   │    Page 3          │
        │   │   (Agent A)        │
        │   │                    │
        │   │ Delete lines       │
        │   │ Use SessionContext │
        │   │                    │
        │   │  2 minutes         │
        │   │ (sequential)       │
        │   │                    │
        │   └────────┬───────────┘
        │            │
        │  All pages complete
        │            │
        └────────────┼──────────────────┐
                     │                  │
        ┌────────────▼────────┐  ┌──────▼──────┐
        │   VERIFICATION      │  │   COMMIT    │
        │   (Agent δ)         │  │  (Agent δ)  │
        │   15 minutes        │  │  5 minutes  │
        └─────────────────────┘  └─────────────┘
                                         │
                                    ✅ DONE
```

---

## Parallelization Benefit

### Sequential Execution (If Pages Done One-by-One)

```
Phase 1 (Prep):           5 min ──────────────────────────┐
Phase 2A (Page 4):        8 min ──────────────────────────┤
Phase 2B (Page 5):       10 min ──────────────────────────┤
Phase 2C (Page 3):        2 min ──────────────────────────├─ 25 min Phase 2
Phase 3 (Verify):        15 min ──────────────────────────┤
Phase 4 (Commit):         5 min ──────────────────────────┘
                                                           ─────────────
TOTAL: 45 minutes
```

### Parallel Execution (Optimized)

```
Phase 1 (Prep):           5 min ──────────────────────────┐
Phase 2A:                                                  │
  ├─ Page 4 (B):         8 min ──────────┐               │
  └─ Page 5 (C):        10 min ──────────┤─ 10 min max   │
Phase 2B:                                 │               │
  └─ Page 3 (A):         2 min ──────────┘ (starts T+8)  │
Phase 3 (Verify):        15 min ──────────────────────────┤─ 40 min TOTAL
Phase 4 (Commit):         5 min ──────────────────────────┘
                                                           ─────────────
TOTAL: 40 minutes
SAVINGS: 5 minutes (11% faster)
```

---

## File Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                      SHARED RESOURCES                           │
└─────────────────────────────────────────────────────────────────┘

src/app/(dashboard)/layout.tsx
│
├─ MODIFIED BY: Agent B (Page 4)
│  └─ Action: Add SessionProvider import + wrapper
│
└─ REQUIRED BY: Agent A (Page 3)
   └─ Action: Use SessionContext from provider
   └─ Dependency: Wait for Agent B to update layout

CONSEQUENCE: Page 3 must start after Page 4 completes layout updates
TIMING: T+8 minimum for Page 3 start


┌─────────────────────────────────────────────────────────────────┐
│                    INDEPENDENT RESOURCES                        │
└─────────────────────────────────────────────────────────────────┘

Page 4 (Agent B):                    Page 5 (Agent C):
├─ src/hooks/useSession.ts           ├─ src/middleware.ts
│  └─ CREATE new file                │  └─ MODIFY line 13
├─ src/app/(dashboard)/layout.tsx    ├─ src/app/(dashboard)/
│  └─ MODIFY: wrap children          │     contracts/templates/page.tsx
└─ src/app/(dashboard)/              │  └─ DELETE lines 49-56
   payments/page.tsx                 └─ src/app/(dashboard)/
   └─ MODIFY: delete useEffect          contracts/layout.tsx
                                        └─ CREATE new file

NO OVERLAP: 0 shared files between P4 & P5
CONSEQUENCE: Can run fully parallel ✓
```

---

## Checkpoint Protocol

### T+0: Start Phase 2A
```
Agent δ signals:
  "Begin Phase 2A - Pages 4 & 5 in parallel"
  
Agent B: "Page 4 starting - creating useSession.ts"
Agent C: "Page 5 starting - updating middleware"
```

### T+4: Agent B Creates Hook
```
Agent B: "useSession.ts created ✓"
  └─ Still working on layout & page updates
```

### T+6-8: Agent B Updates Layout
```
Agent B: "layout.tsx updated with SessionProvider ✓"
         "Checkpoint: layout ready for Page 3"
         
Agent δ: "Page 3 can now start"
Agent A: "Page 3 starting - waiting for next signal"
```

### T+8: Agent B Completes Page 4
```
Agent B: "Page 4 complete - payments/page.tsx updated ✓"
         "Running npm run build... PASS ✓"
         
Agent A: "Page 3 proceeding with useSession hook usage"
```

### T+10: Agent C Completes Page 5
```
Agent C: "Page 5 complete - all files updated ✓"
         "Running npm run build... PASS ✓"
```

### T+10: Agent A Completes Page 3
```
Agent A: "Page 3 complete - lines deleted, hook imported ✓"
         "Running npm run build... PASS ✓"
```

### T+10: Begin Phase 3
```
Agent δ: "All implementations complete. Begin Phase 3 verification"
         "Starting comprehensive testing..."
```

---

## Error Handling in Parallel Execution

### What If Agent B's Build Fails?

```
T+8: Agent B: "ERROR: npm run build failed"
     Error: Cannot find module '@/hooks/useSession'
     
Agent δ: PAUSE Agent A (don't start Page 3 yet)
         "Agent B: Check export statement in useSession.ts"
         
Agent B: "Missing export default... fixing..."
         "Re-running build... PASS ✓"
         
Agent δ: RESUME Agent A
         "Page 3 can now proceed safely"
```

### What If Agent C's Middleware Has Syntax Error?

```
T+9: Agent C: "ERROR: npm run build failed"
     Error: Invalid regex in middleware line 13
     
Agent δ: "Page 5 OK on its own, Page 3 OK on its own"
         "Issue is isolated to middleware"
         
Agent C: "Fixing regex pattern..."
         "Re-running build... PASS ✓"
         
Agent δ: Proceed to Phase 3 (all agents complete)
```

### What If Page 3 Starts Too Early?

```
T+6: Agent A prematurely starts Page 3 without layout
     
Agent A: "ERROR: useSession() hook not available"
         "SessionContext undefined"
         
Agent δ: "STOP - wait for Agent B checkpoint signal"
         "Agent B: Report when layout.tsx is ready"
         
Agent B: "Layout.tsx ready now ✓"
Agent A: RETRY Page 3 implementation
```

**Mitigation:** Agent δ explicitly signals when Page 3 can start

---

## Success Criteria Per Phase

### Phase 2A Success (Parallel)

```
✅ Agent B Page 4: 
   - 3 files created/modified (hook, layout, page)
   - npm run build passes
   - No TypeScript errors
   - useSession hook properly exported
   
✅ Agent C Page 5:
   - 3 files created/modified (middleware, page, layout)
   - npm run build passes
   - No TypeScript errors
   - Middleware regex syntax valid
   
✅ Both complete independently by T+10
```

### Phase 2B Success (Sequential)

```
✅ Agent A Page 3:
   - 1 file modified (dashboard/overview/page.tsx)
   - Starts at T+8 (after layout ready)
   - npm run build passes
   - useSession() hook accessible
   - Session context properly injected
```

### Phase 3 Success (Verification)

```
✅ Build: npm run build full project = PASS
✅ Network: 0 /api/auth/me calls in tab
✅ Functional: All 6 tests pass
✅ Security: No exposed auth logic
✅ Code: No debug code or temp files
```

---

## Timeline Summary

| Phase | Time | Agent | Parallel? | Output |
|-------|------|-------|-----------|--------|
| 1: Prep | 5 min | δ | - | Baseline ready |
| 2A: P4+P5 | 10 min | B+C | ✅ YES | 6 files ready |
| 2B: P3 | 2 min | A | ⚠️ SEQ | All code ready |
| 3: Verify | 15 min | δ | - | Tests pass |
| 4: Commit | 5 min | δ | - | ✅ DONE |
| **TOTAL** | **40 min** | **1δ+1A+1B+1C** | **Mixed** | **Production ready** |

---

**Status:** ✅ Ready to execute with this parallel plan  
**Confidence:** 9/10  
**Risk:** 🟢 LOW
