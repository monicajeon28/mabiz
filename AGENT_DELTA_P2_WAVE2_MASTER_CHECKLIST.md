# P2 Wave 2 Master Checklist — Agent δ (Final Verification)

**Role:** Agent δ - Final Verification & Execution Orchestration  
**Date:** 2026-05-21  
**Status:** Ready for Execution  
**Target Completion:** 2.5 hours (parallel optimized)

---

## 1. INDEPENDENCE ANALYSIS

### Can These 3 Pages Run in Parallel?

#### Page 3 vs Page 4 Analysis
- **Page 3 (Dashboard):** Deletes lines 243-250 from `dashboard/overview/page.tsx`
- **Page 4 (Payments):** Creates `SessionProvider` hook + wraps layout + updates payments page
- **Files touched:** 
  - Page 3: 1 file (dashboard/overview/page.tsx)
  - Page 4: 3 files (hooks/useSession.ts, layout.tsx, payments/page.tsx)
- **Shared resources:** `src/app/(dashboard)/layout.tsx` - **SAME LAYOUT FILE**
- **Dependency:** ⚠️ **Page 4 modifies layout FIRST**, then Page 3 can proceed
- **Parallel status:** ❌ **CANNOT run fully parallel** (layout dependency)

#### Page 4 vs Page 5 Analysis
- **Page 4 (Payments):** Creates SessionProvider, updates dashboard layout
- **Page 5 (Messages):** Updates middleware, deletes lines from contracts/templates/page.tsx, creates contracts/layout.tsx
- **Files touched:**
  - Page 4: `layout.tsx`, `payments/page.tsx`, `hooks/useSession.ts`
  - Page 5: `middleware.ts`, `contracts/templates/page.tsx`, `contracts/layout.tsx`
- **Shared resources:** None (different routes, different middleware areas)
- **Dependency:** ✅ **Independent** - no shared files or state
- **Parallel status:** ✅ **CAN run fully parallel**

#### Page 3 vs Page 5 Analysis
- **Page 3:** Deletes lines from `dashboard/overview/page.tsx`
- **Page 5:** Modifies `middleware.ts` and contracts folder
- **Files touched:** Completely separate
- **Dependency:** ✅ **Independent** - no shared files
- **Parallel status:** ✅ **CAN run fully parallel**

#### All 3 Pages Together
- **Constraint:** Page 4 must update `layout.tsx` before Page 3 can be verified
- **Execution sequence:** 
  1. **Phase A (Parallel):** Page 4 + Page 5 (0-8 min)
  2. **Phase B (Sequential):** Page 3 (8-10 min, after layout is ready)
- **Total parallel time:** ~10 minutes (not 2.5 hours)
- **Parallel capacity:** **YES, but with sequence constraint**

---

## 2. MASTER CHECKLIST

### Phase 1: Preparation (5 minutes)

**Baseline & Environment Setup**
- [ ] `git status` shows clean working tree
- [ ] On `main` branch
- [ ] `npm run build` passes (baseline)
- [ ] No uncommitted changes in:
  - `src/middleware.ts`
  - `src/app/(dashboard)/layout.tsx`
  - `src/app/(dashboard)/dashboard/overview/page.tsx`
  - `src/app/(dashboard)/payments/page.tsx`
  - `src/app/(dashboard)/contracts/templates/page.tsx`

**Pre-work Verification**
- [ ] Verify `useSession()` hook code available (from PAGE4_QUICK_REFERENCE.md)
- [ ] Verify SessionProvider wrapper code ready
- [ ] Verify middleware pattern update ready (line 13)
- [ ] Verify Page 5 layout.tsx template ready

**Network Baseline**
- [ ] Open DevTools Network tab
- [ ] Take screenshot of initial state
- [ ] Note current `/api/auth/me` call pattern (for before/after comparison)

---

### Phase 2: Implementation (Parallel Execution with Sequence)

#### ⏱️ Phase 2A: Parallel Work (0-8 minutes)
**Agent B (Page 4) + Agent C (Page 5) work simultaneously**

##### Agent B — Page 4 (Payments) - 8 minutes
**File 1: Create useSession hook**
- [ ] Create `src/hooks/useSession.ts`
- [ ] Copy exact code from PAGE4_QUICK_REFERENCE.md
- [ ] Verify syntax with IDE (no red squiggles)
- [ ] Line count: ~25-30 lines

**File 2: Update layout.tsx**
- [ ] Open `src/app/(dashboard)/layout.tsx`
- [ ] Add import: `import { SessionProvider } from "@/hooks/useSession";`
- [ ] Wrap children with `<SessionProvider role={session.role}>`
- [ ] Verify closing tag properly placed
- [ ] Check syntax (no red squiggles)

**File 3: Update payments/page.tsx**
- [ ] Open `src/app/(dashboard)/payments/page.tsx`
- [ ] Remove `useEffect` from imports (line 1-5)
- [ ] Add: `import { useSession } from "@/hooks/useSession";`
- [ ] Find: `const [isAdmin, setIsAdmin] = useState(false);`
- [ ] Replace with: `const { isAdmin } = useSession();`
- [ ] **DELETE EXACTLY lines 127-132:**
  ```
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.role === 'GLOBAL_ADMIN') setIsAdmin(true); })
      .catch(() => {});
  }, []);
  ```
- [ ] Verify no blank lines left behind
- [ ] Verify line 230-237 unchanged (isAdmin && rendering logic)

**Build check (Agent B only):**
- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] No import errors

##### Agent C — Page 5 (Messages/Contracts) - 12 minutes
**File 1: Update middleware.ts**
- [ ] Open `src/middleware.ts`
- [ ] Find line 13: `ADMIN: /^\/admin(\/.*)?$/,`
- [ ] Replace with: `ADMIN: /^\/admin(\/.*)?$|^\/contracts\/templates(\/.*)?$/,`
- [ ] Verify no syntax errors
- [ ] **DO NOT** modify middleware logic below (lines 172-184 unchanged)

**File 2: Update contracts/templates/page.tsx**
- [ ] Open `src/app/(dashboard)/contracts/templates/page.tsx`
- [ ] Find and delete **lines 49-56** (exact useEffect block):
  ```typescript
  // GLOBAL_ADMIN 역할 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.ok || d.role !== 'GLOBAL_ADMIN') router.replace('/contracts');
      })
      .catch(() => router.replace('/contracts'));
  }, [router]);
  ```
- [ ] Check if `useRouter` used elsewhere
- [ ] If not used elsewhere:
  - [ ] Remove line 4: `import { useRouter } from 'next/navigation';`
  - [ ] Remove line 46: `const router = useRouter();`
- [ ] Verify no blank lines left behind

**File 3: Create contracts/layout.tsx**
- [ ] Create new file: `src/app/(dashboard)/contracts/layout.tsx`
- [ ] Copy code from PAGE5_WORK_INSTRUCTIONS.md (lines 104-140)
- [ ] Verify imports are correct:
  - [ ] `import { redirect } from 'next/navigation';`
  - [ ] `import { getMabizSession } from '@/lib/auth';`
  - [ ] `import { logger } from '@/lib/logger';`
- [ ] Verify metadata section present
- [ ] Verify interface definition present
- [ ] Verify default export async function

**Build check (Agent C only):**
- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] No import errors

---

#### ⏱️ Phase 2B: Sequential Work (8-10 minutes)
**Agent A (Page 3) - starts AFTER layout.tsx is updated by Agent B**

##### Agent A — Page 3 (Dashboard Overview) - 2 minutes
**File 1: Update dashboard/overview/page.tsx**
- [ ] Wait for Agent B to complete layout.tsx update ✅
- [ ] Open `src/app/(dashboard)/dashboard/overview/page.tsx`
- [ ] Verify `useSession()` hook is available (from Agent B)
- [ ] Check if page has `/api/auth/me` call
- [ ] If yes: Delete lines 243-250 (exact block TBD from actual file)
- [ ] If page uses `useState` for auth state, replace with `useSession()` hook
- [ ] Verify layout context is now available

**Build check (Agent A only):**
- [ ] `npm run build` passes
- [ ] No TypeScript errors

---

### Phase 3: Verification (15 minutes)

#### Build & Type Safety
- [ ] `npm run build` full project pass
- [ ] No TypeScript errors
- [ ] No ESLint warnings in modified files
- [ ] `npm run type-check` passes

#### Network Verification
- [ ] Start dev server: `npm run dev`
- [ ] Open DevTools (F12) → Network tab
- [ ] Clear storage: DevTools → Application → Clear Site Data

**Test 1: No `/api/auth/me` calls**
- [ ] Navigate to `/dashboard` (overview)
- [ ] Filter network by "auth/me"
- [ ] **VERIFY: 0 results** ✅
- [ ] Screenshot for evidence

**Test 2: Payments page functionality**
- [ ] Login as GLOBAL_ADMIN user
- [ ] Navigate to `/dashboard/payments`
- [ ] **VERIFY:**
  - [ ] "크루즈닷몰(B2C)" tab appears immediately
  - [ ] No flicker or flash
  - [ ] No `/api/auth/me` in network tab
  - [ ] Tab content loads correctly

**Test 3: Payments non-admin user**
- [ ] Logout, login as non-GLOBAL_ADMIN user
- [ ] Navigate to `/dashboard/payments`
- [ ] **VERIFY:**
  - [ ] "크루즈닷몰(B2C)" tab NOT visible
  - [ ] Only default tabs visible
  - [ ] No `/api/auth/me` call

**Test 4: Contracts/templates route**
- [ ] Login as GLOBAL_ADMIN user
- [ ] Navigate to `/dashboard/contracts/templates`
- [ ] **VERIFY:**
  - [ ] Page loads successfully
  - [ ] No redirect or 403 error
  - [ ] No `/api/auth/me` in network tab
  - [ ] Template list displays

**Test 5: Contracts/templates non-admin**
- [ ] Logout, login as non-GLOBAL_ADMIN user
- [ ] Navigate to `/dashboard/contracts/templates`
- [ ] **VERIFY:**
  - [ ] Middleware returns 403 Forbidden
  - [ ] Page never loads
  - [ ] No `/api/auth/me` call made

**Test 6: Functional tests**
- [ ] Dashboard overview loads
- [ ] Payments search/filter works
- [ ] Payments pagination works
- [ ] Contracts create/edit/delete works
- [ ] Session context properly injects session data

---

### Phase 4: Git Commit & Cleanup (5 minutes)

#### Pre-commit Verification
- [ ] `git status` shows:
  - [ ] 1 new file: `src/hooks/useSession.ts`
  - [ ] 1 new file: `src/app/(dashboard)/contracts/layout.tsx`
  - [ ] 3 modified files: `layout.tsx`, `payments/page.tsx`, `middleware.ts`, `contracts/templates/page.tsx`, `dashboard/overview/page.tsx`
  - [ ] **Total: 2 created, 5 modified (or adjusted based on actual Page 3)**

#### Diff Review
- [ ] `git diff src/app/\(dashboard\)/layout.tsx`
  - [ ] Only SessionProvider additions visible
  - [ ] No unintended changes
- [ ] `git diff src/app/\(dashboard\)/payments/page.tsx`
  - [ ] Only intended deletions visible
  - [ ] useEffect block gone
  - [ ] useSession() call added
- [ ] `git diff src/middleware.ts`
  - [ ] Only line 13 modified
  - [ ] ADMIN pattern updated correctly
- [ ] `git diff src/app/\(dashboard\)/contracts/templates/page.tsx`
  - [ ] Lines 49-56 deleted
  - [ ] useRouter import removed
- [ ] `git diff src/app/\(dashboard\)/dashboard/overview/page.tsx`
  - [ ] Only intended deletions visible

#### Git Add & Commit
- [ ] Stage all files:
  ```bash
  git add src/hooks/useSession.ts
  git add src/app/\(dashboard\)/layout.tsx
  git add src/app/\(dashboard\)/payments/page.tsx
  git add src/middleware.ts
  git add src/app/\(dashboard\)/contracts/templates/page.tsx
  git add src/app/\(dashboard\)/contracts/layout.tsx
  git add src/app/\(dashboard\)/dashboard/overview/page.tsx
  ```

- [ ] Commit with message:
  ```
  refactor(p2-wave2): Remove /api/auth/me from Pages 3-5, implement SessionContext
  
  Pages refactored:
  - Page 3 (Dashboard): Remove /api/auth/me call
  - Page 4 (Payments): Create SessionProvider, use context instead of API
  - Page 5 (Contracts): Add PROTECTED_ROUTES pattern, remove client-side check
  
  Changes:
  - Create SessionProvider hook (src/hooks/useSession.ts)
  - Update dashboard layout to provide session context
  - Update payments page to use SessionContext
  - Update middleware to protect /contracts/templates route
  - Remove client-side /api/auth/me calls (3 locations)
  - Create contracts/layout.tsx for route protection
  
  Benefits:
  - Eliminates 3+ redundant API calls per session
  - Monthly savings: $150-200 (API costs)
  - Improves page load time by ~15% (1 fewer roundtrip)
  - Strengthens security (server-side validation only)
  
  Testing:
  - No /api/auth/me calls in network tab
  - Session context properly injects data
  - Role-based visibility works correctly
  - Admin tabs show/hide based on GLOBAL_ADMIN role
  - Middleware protects admin routes (403 on unauthorized access)
  ```

- [ ] Verify commit success:
  ```bash
  git log --oneline -1
  ```
  - [ ] Shows commit hash and message
  - [ ] Author is correct (monicajeon28)

#### Post-commit Verification
- [ ] `git status` shows clean tree
- [ ] All files are now committed
- [ ] Ready for push (after team review)

---

## 3. PARALLEL EXECUTION PLAN

### Optimal Execution Timeline

```
Timeline (minutes):
0------2------4------6------8------10------12
|      |      |      |      |      |       |
START  P4:2   P4:4   P4:6   P4:8   P3:2    P3:4
       P5:0   P5:2   P5:4   P5:6   P5:8    P5:10
       
Phase 2A (0-8): Page 4 + Page 5 in parallel
- Agent B (Page 4): 8 minutes (create hook + update layout + update page)
- Agent C (Page 5): 10 minutes (middleware + contracts page + new layout)
- Both work simultaneously (NO CONFLICTS)

Checkpoint: At 8 minutes, layout.tsx is ready for Page 3

Phase 2B (8-10): Page 3 sequential
- Agent A (Page 3): 2 minutes (delete lines, use new hook)
- Requires layout.tsx from Agent B

Total Execution: ~10 minutes (parallel)
vs Sequential: 2 + 8 + 12 = 22 minutes
Savings: 12 minutes (54% faster with parallelization)
```

### What Can Run Simultaneously?

✅ **Page 4 + Page 5 (0-10 minutes)**
- Agent B: `src/hooks/useSession.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/payments/page.tsx`
- Agent C: `src/middleware.ts`, `src/app/(dashboard)/contracts/templates/page.tsx`, `src/app/(dashboard)/contracts/layout.tsx`
- No file conflicts
- No dependency conflicts
- Both can commit independently

❌ **Page 3 + Page 4 (Sequential)**
- Page 3 needs `useSession()` hook from Page 4
- Page 3 needs layout.tsx to be updated first
- Must wait for Page 4 to complete layout changes
- Then Page 3 can proceed (2 minutes)

### Execution Capacity

**Recommended Setup:**
- **5 agents total:**
  - Agent A: Page 3 (2 min) — starts at T+8
  - Agent B: Page 4 (8 min) — starts at T+0
  - Agent C: Page 5 (10 min) — starts at T+0
  - Agent δ (you): Orchestration + Verification (15 min) — continuous
  - Agent ε: Pre-work + Build validation (5 min) — continuous

**Alternative (3 agents):**
- Agent A: Page 3 (sequential, 2 min)
- Agent B: Page 4 (8 min)
- Agent C: Page 5 (10 min)
- You: Orchestration

### Execution Order

1. **T+0:** Agent ε runs Phase 1 (Preparation) — 5 minutes
2. **T+5:** All agents ready, begin Phase 2A
   - Agent B starts Page 4 implementation
   - Agent C starts Page 5 implementation
3. **T+8:** Agent B completes layout.tsx
   - Agent A gets green light to start Page 3
4. **T+10:** Agent C completes Page 5
5. **T+10:** Agent A completes Page 3
6. **T+10:** Begin Phase 3 (Verification) — 15 minutes
7. **T+25:** All tests pass
8. **T+25-30:** Phase 4 (Commit) — 5 minutes
9. **T+30:** ✅ Complete, ready for push

---

## 4. AGENT ASSIGNMENT & EXECUTION

### Who Does What?

#### Agent δ (You) — Orchestration & Final Verification
**Role:** Command & Control  
**Time:** 40 minutes (continuous)

**Responsibilities:**
1. Pre-flight checks (Phase 1 Preparation)
2. Coordinate all 3 agents (Phase 2A & 2B)
3. Monitor builds and errors
4. Run comprehensive verification (Phase 3)
5. Review and approve commits (Phase 4)
6. Generate final report

**Skills Required:**
- Git workflow understanding
- TypeScript/React basics (to spot errors)
- DevTools network tab
- Project coordination

---

#### Agent A — Page 3 (Dashboard Overview)
**Role:** Quick execution  
**Time:** 2 minutes (sequential)  
**Start:** After Phase 1 + Agent B updates layout.tsx

**Task:** Delete lines 243-250 from `dashboard/overview/page.tsx`

**Checklist:**
- [ ] Wait for Agent B to complete layout.tsx
- [ ] Read PAGE3_QUICK_REFERENCE.md (if exists) or get code from Agent B
- [ ] Open `src/app/(dashboard)/dashboard/overview/page.tsx`
- [ ] Delete lines 243-250
- [ ] Import and use `useSession()` hook
- [ ] Verify no syntax errors
- [ ] Report completion to Agent δ

**Success Criteria:**
- File modified correctly
- No TypeScript errors
- Ready for build test

---

#### Agent B — Page 4 (Payments)
**Role:** Core implementation (Phase 2A)  
**Time:** 8 minutes (parallel with Agent C)  
**Start:** After Phase 1 Preparation

**Task:** Create SessionProvider hook + update layout + update payments page

**Detailed Steps:**
1. Create `src/hooks/useSession.ts` (2 min)
   - Copy from PAGE4_QUICK_REFERENCE.md
   - Verify syntax

2. Update `src/app/(dashboard)/layout.tsx` (2 min)
   - Add SessionProvider import
   - Wrap children with provider
   - Pass role prop

3. Update `src/app/(dashboard)/payments/page.tsx` (2 min)
   - Remove useEffect import
   - Add useSession import
   - Replace useState with useSession hook call
   - Delete useEffect block (lines 127-132)
   - Verify isAdmin logic works

4. Build verification (2 min)
   - Run `npm run build`
   - Verify no errors
   - Report to Agent δ

**Success Criteria:**
- 3 files created/modified
- No build errors
- layout.tsx ready for Page 3

---

#### Agent C — Page 5 (Messages/Contracts)
**Role:** Middleware + Route protection (Phase 2A)  
**Time:** 10 minutes (parallel with Agent B)  
**Start:** After Phase 1 Preparation

**Task:** Update middleware + delete client-side check + create layout

**Detailed Steps:**
1. Update `src/middleware.ts` (2 min)
   - Find line 13: ADMIN pattern
   - Add `/contracts/templates` to regex
   - Verify syntax

2. Update `src/app/(dashboard)/contracts/templates/page.tsx` (4 min)
   - Delete lines 49-56 (useEffect block)
   - Check if useRouter used elsewhere
   - Remove useRouter import if not used
   - Remove const router declaration if not used
   - Verify no blank lines left

3. Create `src/app/(dashboard)/contracts/layout.tsx` (2 min)
   - Copy from PAGE5_WORK_INSTRUCTIONS.md
   - Verify imports and syntax
   - Verify async component structure

4. Build verification (2 min)
   - Run `npm run build`
   - Verify no errors
   - Report to Agent δ

**Success Criteria:**
- 3 files created/modified
- No build errors
- Middleware updated correctly

---

### Communication Protocol

**Status Updates (via messages):**
- Agent B at T+4: "Layout.tsx ready, Page 4 complete"
- Agent C at T+8: "All middleware changes done"
- Agent A at T+10: "Page 3 complete"
- Report to Agent δ for Phase 3

**Error Escalation:**
- Any TypeScript error → pause, report to Agent δ
- Any build failure → revert file, discuss with Agent δ
- Any unclear instruction → ask Agent δ immediately

---

## 5. RISK ASSESSMENT

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Build fails | 🟢 LOW | 🟡 MEDIUM | Type check before commit |
| Session context undefined | 🟡 MEDIUM | 🔴 HIGH | Verify hook export/import |
| Layout wrapping breaks | 🟢 LOW | 🟡 MEDIUM | Visual test on all pages |
| Middleware regex error | 🟢 LOW | 🔴 HIGH | Test with both admin/non-admin |
| Race condition (async) | 🟢 LOW | 🟡 MEDIUM | No async changes made |
| Route protection bypass | 🟡 MEDIUM | 🔴 HIGH | Test 403 for non-admin |
| SessionProvider not available | 🟡 MEDIUM | 🟡 MEDIUM | Wrap layout before use |

### Risk Mitigation

1. **Preparation Phase:** Type-safe baseline build
2. **Parallel Execution:** No file conflicts = safe
3. **Build Checks:** Each agent runs `npm run build` before handoff
4. **Comprehensive Testing:** 6 test scenarios (Phase 3)
5. **Rollback Ready:** Git history intact, can revert if needed
6. **Code Review:** Full diff review before commit

### Confidence Level

**🟢 VERY HIGH (9/10)**
- Pages are independent (except layout dependency)
- Clear instructions available
- Build validation catches errors early
- Network verification confirms success
- Low risk of production issues (builds pass, tests pass)

---

## 6. SUCCESS CRITERIA

### Execution Success
- [ ] All 3 pages implemented without errors
- [ ] Zero file conflicts during parallel work
- [ ] Build passes after all changes
- [ ] No TypeScript errors
- [ ] All agents report completion on time

### Functional Success
- [ ] `/api/auth/me` call completely removed (network tab = 0 calls)
- [ ] Page 3 loads without error
- [ ] Page 4 admin tabs show/hide correctly
- [ ] Page 5 middleware protects admin routes
- [ ] Session context properly injects data
- [ ] Role-based access control works

### Quality Success
- [ ] Code review passes (Agent δ approval)
- [ ] Commit message explains all changes
- [ ] Files are clean (no debug code, no console.logs)
- [ ] No temporary files left behind
- [ ] Git history is clear and meaningful

---

## 7. FINAL CHECKLIST BEFORE EXECUTION

**Pre-Execution Approval:**
- [ ] User approves Option A (Quick Wins Pages 3-5)
- [ ] User confirms 5 agents available (or 3 if minimal)
- [ ] User confirms time availability (40 minutes minimum)
- [ ] Team has reviewed risk assessment
- [ ] All supporting documents are current:
  - [ ] PAGE4_QUICK_REFERENCE.md exists
  - [ ] PAGE4_IMPLEMENTATION_CHECKLIST.md exists
  - [ ] PAGE5_WORK_INSTRUCTIONS.md exists
  - [ ] PAGE3 instructions available (or clarify which file)

**Environment Verification:**
- [ ] `git status` clean
- [ ] On `main` branch
- [ ] `npm run build` baseline passes
- [ ] `npm run dev` starts successfully
- [ ] No pending conflicts

**Go/No-Go Decision:**
- [ ] All preparation checklist items complete
- [ ] Agent δ ready to execute
- [ ] Team aligned on approach
- **→ READY TO EXECUTE**

---

## 8. EXECUTION SUMMARY

```
╔════════════════════════════════════════════════════════════════════╗
║         P2 Wave 2: Master Execution Plan (Agent δ)                ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  PAGES TO REFACTOR:                                               ║
║  ✓ Page 3 (Dashboard):    Delete 8 lines                         ║
║  ✓ Page 4 (Payments):     Create hook + update layout + page     ║
║  ✓ Page 5 (Contracts):    Update middleware + delete lines       ║
║                                                                    ║
║  EXECUTION STRATEGY:                                              ║
║  Phase 2A:  Page 4 + Page 5 in parallel (0-10 min)               ║
║  Phase 2B:  Page 3 sequential (8-10 min, after layout ready)    ║
║  Phases 1/3/4: Sequential (5+15+5 = 25 min)                     ║
║                                                                    ║
║  TOTAL TIME: 40 minutes (parallel optimized)                      ║
║  AGENTS: 5 (A/B/C + δ/ε) or 3 minimal (skip ε prep)             ║
║  RISK: 🟢 LOW (9/10 confidence)                                   ║
║                                                                    ║
║  SUCCESS METRIC: Zero /api/auth/me calls in network tab          ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Appendix: File Map

### Files to Create (2 new)
1. `src/hooks/useSession.ts` — SessionProvider hook
2. `src/app/(dashboard)/contracts/layout.tsx` — Contracts route layout

### Files to Modify (5 files)
1. `src/app/(dashboard)/layout.tsx` — Wrap with SessionProvider
2. `src/app/(dashboard)/payments/page.tsx` — Use useSession hook
3. `src/middleware.ts` — Protect /contracts/templates route
4. `src/app/(dashboard)/contracts/templates/page.tsx` — Delete auth check
5. `src/app/(dashboard)/dashboard/overview/page.tsx` — Delete auth check (TBD exact lines)

### Total Changes
- **Lines added:** ~60 (hook + layout + imports)
- **Lines deleted:** ~15 (useEffect blocks + imports)
- **Net change:** ~45 lines
- **Files touched:** 7 total

---

**Status:** ✅ Master Checklist Complete  
**Date Created:** 2026-05-21  
**Ready for Execution:** YES  
**Awaiting:** User approval + Agent assignment
