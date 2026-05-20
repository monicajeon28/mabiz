# P0-5 Server Component QA - Quick Reference Card
## Fast Checklist for Deployment & Testing Teams

**Print this page. Use during deployment window (2-hour window).**

---

## ⚡ 60-Second Pre-Deployment Check

**STOP if any of these fail:**

### [ ] 1. TypeScript Build
```bash
npm run build
# Expected: Exit code 0, no errors
# ❌ STOP if: Exit code 1 or TypeScript errors
```

### [ ] 2. Network Calls (No /api/auth/me)
```
1. DevTools → Network tab
2. Hard refresh page
3. Search for: /api/auth/me
# Expected: 0 results
# ❌ STOP if: Any /api/auth/me call appears
```

### [ ] 3. Auth Data Visible
```
1. Log in
2. Check header for user name
# Expected: User name visible immediately (no flicker)
# ❌ STOP if: Blank space, "undefined", or delayed appearance
```

### [ ] 4. Console Clean
```
1. Open DevTools → Console
2. Hard refresh & log in
# Expected: 0 errors (warnings OK)
# ❌ STOP if: Red error messages about "session" or "undefined"
```

---

## 🧪 5-Minute Smoke Test

| Step | Expected | Status |
|------|----------|--------|
| **Fresh Login** | User name appears, no /api/auth/me call | ✅ ❌ |
| **Logout** | Redirects to login page, session cleaned | ✅ ❌ |
| **Two Tabs** | Both show same user name, no duplicate calls | ✅ ❌ |
| **Slow Network** | No blank screen on 3G throttling | ✅ ❌ |
| **Invalid Session** | Graceful error/redirect, not 500 page | ✅ ❌ |

**Pass = All ✅. Fail = Any ❌ = ROLLBACK**

---

## 🚨 Rollback Emergency Commands

```bash
# If testing fails:
git log --oneline -5
git revert <COMMIT_HASH> --no-edit
npm run build  # Verify build works
git push origin main
# Notify: Team slack + stakeholders
```

---

## 📊 Performance Targets

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Network Auth Calls | 0 | ___ | ✅ ❌ |
| TTI (sec) | <3.0 | ___ | ✅ ❌ |
| Improvement vs Before | +15% | ___ | ✅ ❌ |
| Lighthouse Score | ≥90 | ___ | ✅ ❌ |

---

## 🔐 Security Quick Checks

| Check | Expected | Result |
|-------|----------|--------|
| XSS in user name | Escaped text (not executable JS) | ✅ ❌ |
| API key in HTML | Not visible in Page Source | ✅ ❌ |
| Session hijack | Fails with same-origin/device markers | ✅ ❌ |
| CSRF on logout | Requires token, fails without it | ✅ ❌ |

---

## 🌐 Browser Quick Test (1 min each)

```
Chrome:    Log in → Check user name → Check console (0 errors) → ✅
Firefox:   Same process → ✅
Safari:    Same process → ✅
Mobile:    Same process on iOS or Android → ✅
```

**All ✅? PASS. Any ❌? INVESTIGATE.**

---

## 📱 Mobile Quick Test

```
1. Open on iPhone/Android
2. Log in with test credentials
3. Verify user name appears
4. Check Network tab (no /api/auth/me)
5. Verify session persists after backgrounding app
```

**Result: ✅ PASS or ❌ FAIL**

---

## 📞 Issues & Quick Fixes

| Issue | Quick Fix | Escalate To |
|-------|-----------|-------------|
| /api/auth/me still called | Check layout.tsx has session props passed | Agent α |
| "undefined" in header | User.name missing fallback in component | Agent β |
| Flicker on login | Animation timing issue, reduce duration | Agent β |
| Console errors about session | Check prop types match data structure | Agent α |
| Performance not improved | Check for N+1 queries in auth flow | Agent β |

---

## ✅ Deployment Sign-Off

**Print & Sign**:

```
P0-5 Server Component Testing Complete

Date: ___________
Tester: ___________
Build Version: ___________

P0 (Auth Flow): ✅ ❌
P1 (UX): ✅ ❌
P2 (Errors): ✅ ❌
P3 (Performance): ✅ ❌
P4 (Security): ✅ ❌
P5 (Browsers): ✅ ❌

OVERALL: ✅ APPROVED / ❌ REJECTED

Notes:
_______________________________________

Escalations (if any):
_______________________________________

Time Started: ________  Time Ended: ________
```

---

## 🔔 24-Hour Monitoring Checklist

**Every 6 hours, run this**:

```
Time: ___________

[ ] 401/403 errors < 1%/min (check Sentry dashboard)
[ ] Support tickets: 0 auth-related issues
[ ] TTI still < 3.0s (run Lighthouse quick)
[ ] Console clean (no new errors)
[ ] Login/logout working (quick test)

Result: ✅ All good | ❌ Issue found → Investigate & report
```

**DO THIS 4 TIMES IN FIRST 24 HOURS**

---

## 💾 Test Environment Checklist

Before testing, verify:

- [ ] Latest code pulled (`git pull origin main`)
- [ ] Dependencies fresh (`npm install`)
- [ ] Build succeeds (`npm run build`)
- [ ] Local server runs (`npm run dev`)
- [ ] Cookies cleared (fresh state)
- [ ] DevTools open & Network tab active
- [ ] Console tab visible for errors
- [ ] Test user account credentials ready

---

## 📊 Quick Metrics Report

```
Server Component Auth Optimization - Test Results
================================================

Build Status:           _____ (✅ PASS / ❌ FAIL)
TypeScript Errors:      _____ (Expected: 0)
Network Calls (Auth):   _____ (Expected: 0)
TTI Time:              _____ sec (Expected: <3.0s)
Lighthouse Score:       _____ (Expected: ≥90)
Browsers Tested:       _____ (Expected: 5+)
Devices Tested:        _____ (Expected: 2+)

Security Review:        _____ (✅ PASS / ❌ FAIL)
XSS Tests:             _____ (✅ PASS / ❌ FAIL)
Performance Tests:      _____ (✅ PASS / ❌ FAIL)
Regression Tests:       _____ (✅ PASS / ❌ FAIL)

Overall Status:         ✅ GO / ❌ NO-GO

Go/No-Go Reason:
____________________________________________

Signed: ________________  Date: __________
```

---

## 🎯 Critical Path (Do These First)

1. **TypeScript Build** (2 min)
   ```bash
   npm run build
   ```

2. **Fresh Login** (3 min)
   - Clear cookies
   - Log in
   - Check user name appears
   - Check Network tab for /api/auth/me (should be 0)

3. **Console Check** (1 min)
   - DevTools → Console
   - Hard refresh
   - Verify 0 red errors

4. **Mobile Test** (3 min)
   - Log in on mobile
   - Verify user name appears
   - Check session persists

5. **Rollback Test** (2 min)
   - Know the rollback command
   - Understand when to use it
   - Test on staging first if unsure

**Total: ~11 minutes to clear critical path**

---

## 🚀 Deployment Stages

### Phase 1: Pre-Deployment (30 min before)
- [ ] Run 60-second pre-check
- [ ] Verify rollback procedure
- [ ] Team standup (2 min)
- [ ] Clear deployment window with stakeholders

### Phase 2: Deployment (5-10 min)
- [ ] Push code to main
- [ ] Monitor Vercel build
- [ ] Verify build succeeds in CI/CD

### Phase 3: Post-Deployment (2 hours)
- [ ] Run 5-minute smoke test immediately
- [ ] Monitor error rate in Sentry
- [ ] Check support tickets
- [ ] Repeat smoke test every 30 min

### Phase 4: Stability Check (24 hours)
- [ ] Automated monitoring running
- [ ] Manual spot checks every 6 hours
- [ ] Team available for escalation
- [ ] Rollback command ready if needed

---

## 📝 Test Execution Log

```
Timestamp   | Test | Result | Notes
------------|------|--------|-------
[__:__]     | Build | ✅/❌ | 
[__:__]     | Login | ✅/❌ | 
[__:__]     | Network | ✅/❌ | 
[__:__]     | Console | ✅/❌ | 
[__:__]     | Mobile | ✅/❌ | 
[__:__]     | Perf | ✅/❌ | 
[__:__]     | Security | ✅/❌ | 
[__:__]     | Browsers | ✅/❌ | 
```

---

## ⚠️ CRITICAL: DO NOT DEPLOY IF...

- [ ] TypeScript build fails
- [ ] /api/auth/me calls still appear
- [ ] "undefined" text visible in UI
- [ ] Console has red errors
- [ ] Any browser shows broken auth
- [ ] Mobile login doesn't work
- [ ] Performance regression >20%
- [ ] Rollback procedure not tested

**If ANY of above = STOP. Investigate. Fix. Re-test. Then deploy.**

---

**Last Updated**: 2026-05-20  
**For**: Menu #38 Phase 4 / Server Component Auth  
**Print & Keep Handy During Deployment**
