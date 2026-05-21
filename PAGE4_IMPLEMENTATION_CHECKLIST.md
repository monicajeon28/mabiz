# Page 4 Implementation Checklist

**Task:** Remove `/api/auth/me` from payments page
**Agent:** β
**Status:** Ready for Implementation
**Priority:** P0
**Estimated Time:** 8 minutes

---

## PRE-IMPLEMENTATION

- [ ] Read PAYMENTS_PAGE_REFACTOR_INSTRUCTIONS.md completely
- [ ] Read PAGE4_QUICK_REFERENCE.md 
- [ ] Understand the difference between `/api/auth/me` (client-side) vs `getMabizSession()` (server-side)
- [ ] Verify you're on `main` branch
- [ ] Confirm no uncommitted changes in dashboard files

```bash
# Check branch
git branch
# Expected: * main

# Check status
git status
# Expected: nothing to commit
```

---

## IMPLEMENTATION STEPS

### Phase 1: Create Hook (2 minutes)

- [ ] Create new file: `src/hooks/useSession.ts`
- [ ] Copy exact code from PAGE4_QUICK_REFERENCE.md section "1️⃣ CREATE"
- [ ] Verify file was created
  ```bash
  ls -la src/hooks/useSession.ts
  ```

### Phase 2: Update Layout (2 minutes)

- [ ] Open `src/app/(dashboard)/layout.tsx`
- [ ] **Line 1-6:** Add import: `import { SessionProvider } from "@/hooks/useSession";`
- [ ] **Line 29-37:** Wrap `<div>` with `<SessionProvider role={session.role}>`
  - Must close with `</SessionProvider>` after `</div>`
- [ ] Verify no syntax errors (check IDE for red squiggles)

**Verification:**
```bash
# Should show SessionProvider import
grep -n "SessionProvider" src/app/\(dashboard\)/layout.tsx
# Expected: import line + opening tag + closing tag = 3 results
```

### Phase 3: Update Payments Page (2 minutes)

- [ ] Open `src/app/(dashboard)/payments/page.tsx`

**3A. Update imports (lines 1-5):**
- [ ] Remove `useEffect` from imports
- [ ] Add `import { useSession } from "@/hooks/useSession";`

**3B. Replace state with hook (lines 81-82):**
- [ ] Find: `const [isAdmin, setIsAdmin] = useState(false);`
- [ ] Replace with: `const { isAdmin } = useSession();`

**3C. Delete useEffect (lines 127-132):**
```typescript
// DELETE EXACTLY THESE LINES:
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.role === 'GLOBAL_ADMIN') setIsAdmin(true); })
      .catch(() => {});
  }, []);
```

- [ ] Confirmed: useEffect block deleted completely
- [ ] Confirmed: No blank lines left behind (clean deletion)

**3D. Verify line 230-237 is unchanged:**
- [ ] `{isAdmin && (` still there
- [ ] Mall tab button still there
- [ ] No edits made to this section

**Verification:**
```bash
# Confirm no /api/auth/me reference
grep -n "api/auth/me" src/app/\(dashboard\)/payments/page.tsx
# Expected: No results (empty)

# Confirm useSession is used
grep -n "useSession" src/app/\(dashboard\)/payments/page.tsx
# Expected: 1 import + 1 hook call = 2 lines
```

---

## TESTING (2 minutes)

### Test 1: Build Check
```bash
npm run build
```
- [ ] Build succeeds (no TypeScript errors)
- [ ] No import errors related to useSession

### Test 2: Network Verification
- [ ] Start dev server: `npm run dev`
- [ ] Open DevTools (F12) → Network tab
- [ ] Navigate to `/dashboard/payments`
- [ ] Filter network by "auth/me"
- [ ] **VERIFY: No `/api/auth/me` request should appear** ✓

### Test 3: Admin Tab Visibility (GLOBAL_ADMIN user)
- [ ] Login as GLOBAL_ADMIN user
- [ ] Navigate to `/dashboard/payments`
- [ ] **VERIFY: "크루즈닷몰(B2C)" tab appears immediately** (no flicker)
- [ ] Click tab → should load mall payments

### Test 4: Non-Admin Tab Hidden (MEMBER user)
- [ ] Login as non-GLOBAL_ADMIN user (e.g., MEMBER role)
- [ ] Navigate to `/dashboard/payments`
- [ ] **VERIFY: "크루즈닷몰(B2C)" tab NOT visible**
- [ ] Only "결제 내역" and "정기결제" tabs visible

### Test 5: Page Functionality
For both admin and non-admin users:
- [ ] Search functionality works
- [ ] Filter dropdown works
- [ ] Pagination works
- [ ] Refund button works (if applicable)
- [ ] Subscription tab loads correctly

---

## GIT COMMIT

### Pre-Commit Verification
```bash
git status
```
- [ ] Shows 3 files: 1 new (useSession.ts), 2 modified (layout.tsx, payments.tsx)

### Diff Review
```bash
git diff src/app/\(dashboard\)/layout.tsx
git diff src/app/\(dashboard\)/payments/page.tsx
```
- [ ] Confirm only the intended changes are there
- [ ] No extra whitespace changes
- [ ] No debug code left behind

### Commit
```bash
git add src/hooks/useSession.ts
git add src/app/\(dashboard\)/layout.tsx
git add src/app/\(dashboard\)/payments/page.tsx
git commit -m "refactor(payments): Remove /api/auth/me call, use SessionContext instead

- Create SessionProvider hook to pass role from server
- Update dashboard layout to wrap children with SessionProvider  
- Remove useEffect + /api/auth/me fetch from payments page
- isAdmin now computed from server-side session role

Benefits:
- Eliminates unnecessary network call
- Removes race condition (no more state flicker)
- Improves page load time

Test:
- Admin tab shows/hides based on GLOBAL_ADMIN role
- No /api/auth/me in network tab"
```

- [ ] Commit successful (shows hash and 3 files changed)

### Post-Commit
```bash
git log --oneline -1
```
- [ ] Shows your commit message
- [ ] Verify author is correct (monicajeon28)

---

## FINAL VERIFICATION

```bash
# Confirm files exist
test -f src/hooks/useSession.ts && echo "✓ Hook created"
test -f src/app/\(dashboard\)/layout.tsx && echo "✓ Layout updated"
test -f src/app/\(dashboard\)/payments/page.tsx && echo "✓ Payments updated"

# Confirm no /api/auth/me remains
! grep -q "api/auth/me" src/app/\(dashboard\)/payments/page.tsx && echo "✓ /api/auth/me removed"

# Confirm useSession is used
grep -q "useSession" src/app/\(dashboard\)/payments/page.tsx && echo "✓ useSession hook imported and used"

# Verify SessionProvider wraps layout
grep -q "SessionProvider" src/app/\(dashboard\)/layout.tsx && echo "✓ SessionProvider wraps layout"
```

**Expected Output:**
```
✓ Hook created
✓ Layout updated
✓ Payments updated
✓ /api/auth/me removed
✓ useSession hook imported and used
✓ SessionProvider wraps layout
```

---

## TROUBLESHOOTING

### Problem: TypeScript errors after changes
**Solution:**
```bash
npm run type-check
# If errors, verify imports are correct:
# - useSession imported from @/hooks/useSession
# - SessionProvider imported in layout.tsx
```

### Problem: `/api/auth/me` still appears in network tab
**Solution:**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache: DevTools → Application → Clear Storage
- Verify useEffect was completely deleted (not just commented out)

### Problem: Admin tab missing when logged in as GLOBAL_ADMIN
**Solution:**
- Verify `session.role === 'GLOBAL_ADMIN'` is correct value
- Add debug: `console.log('role:', role)` in useSession hook
- Check that `/api/auth/me` was actually returning `role: 'GLOBAL_ADMIN'`

### Problem: Build fails
**Solution:**
```bash
npm run build 2>&1 | head -20
# Look for specific error messages
# Usually: missing import or syntax error
```

---

## SIGN-OFF

| Task | Owner | Status |
|------|-------|--------|
| Implementation Ready | β | ✓ |
| Documentation Complete | β | ✓ |
| Testing Plan Provided | β | ✓ |
| Ready for Execution | β | ⏳ Awaiting execution |

---

## QUICK LINKS

- **Full Instructions:** [PAYMENTS_PAGE_REFACTOR_INSTRUCTIONS.md](./PAYMENTS_PAGE_REFACTOR_INSTRUCTIONS.md)
- **Code Reference:** [PAGE4_QUICK_REFERENCE.md](./PAGE4_QUICK_REFERENCE.md)
- **Target File 1:** `src/hooks/useSession.ts` (CREATE)
- **Target File 2:** `src/app/(dashboard)/layout.tsx` (MODIFY)
- **Target File 3:** `src/app/(dashboard)/payments/page.tsx` (MODIFY)

---

**Time to Complete:** ~8 minutes
**Difficulty:** Medium (context pattern introduction)
**Impact:** High (eliminates unnecessary network call)
