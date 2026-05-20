# P0-5 Server Component Authentication QA Testing Checklist
## Comprehensive Testing Guide for Server-Side Auth Props Approach

**Document Version**: 1.0  
**Date**: 2026-05-20  
**Prepared by**: Agent γ (UX/QA & Testing)  
**Status**: Final QA Framework  

---

## 📋 Executive Summary

This QA checklist validates the **Server Component auth optimization** that eliminates redundant `/api/auth/me` client-side fetches by passing session data directly as component props during server-side rendering.

**Key Testing Areas**:
1. **P0: Auth Data Flow** - Props delivery & consistency
2. **P1: UX Continuity** - No regressions or flicker
3. **P2: Error Handling** - Graceful failures
4. **P3: Performance** - Network call optimization
5. **P4: Security** - Session isolation & XSS protection
6. **P5: Browser Compatibility** - Cross-platform stability

---

## 🎯 P0: Authentication Data Flow (CRITICAL)

### P0.1: Initial Page Load - Fresh Session
**Objective**: Verify auth data arrives via props, no redundant `/api/auth/me` call

**Environment**: Local dev, clean browser state
**Steps**:
```
1. Clear all cookies/localStorage:
   DevTools → Application → Cookies → [site] → Delete All
   DevTools → Application → Local Storage → Clear All

2. Open DevTools → Network tab (Filter: XHR/Fetch)

3. Hard refresh page (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac)

4. Immediately log in with valid credentials

5. Monitor Network tab for first 10 seconds
```

**Assertions**:
- [ ] Login page appears (not dashboard), no white flicker
- [ ] Console shows NO errors about undefined `session`
- [ ] Network shows NO request to `/api/auth/me` during initial load
- [ ] After successful login:
  - [ ] User name displays correctly in header/sidebar
  - [ ] Organization name shows accurately
  - [ ] Dashboard content renders (not blank)
  - [ ] No "undefined" or "null" text in UI

**Expected Network Call Pattern**:
```
✅ /api/auth/signin (POST) - Login
✅ /api/auth/callback (GET) - OAuth redirect
✅ Dashboard page HTML (GET) - With embedded session in props
❌ /api/auth/me (SHOULD NOT EXIST)

Total calls: 3-4 (not 5-6)
Savings: ~200ms (eliminated 1 auth call)
```

**Failure Handling**:
- If `/api/auth/me` is called:
  - [ ] Mark as **P0 BLOCKER**: Props not properly populated
  - [ ] Check: Layout.tsx has `await getSession()`
  - [ ] Check: Props passed to all child components
  - [ ] Rerun after fix

---

### P0.2: Session Prop Type Safety
**Objective**: Verify TypeScript compilation, no prop validation errors

**Environment**: Local dev
**Steps**:
```bash
# Run TypeScript compiler in strict mode
npm run build

# Capture full output
npm run build 2>&1 | tee build.log
```

**Assertions**:
- [ ] Build succeeds (exit code 0)
- [ ] No TypeScript errors in build output
- [ ] All `session` props properly typed:
  ```typescript
  // ✅ Expected pattern:
  interface LayoutProps {
    session: Session | null;
    children: React.ReactNode;
  }
  
  // ❌ Anti-pattern (should NOT exist):
  interface LayoutProps {
    children: React.ReactNode; // session missing
  }
  ```
- [ ] No React PropTypes warnings in console
- [ ] No "missing prop" warnings in ESLint

**Verification Commands**:
```bash
# Check for type errors
npm run type-check

# Verify no untyped any
npm run lint -- --rule "@typescript-eslint/no-explicit-any: error"
```

---

### P0.3: Session Data Integrity
**Objective**: Verify session data matches database state, no stale data

**Environment**: Local dev, logged-in user
**Steps**:
```
1. Log in to dashboard as Test User

2. Open DevTools → Sources → [filename].tsx layout component

3. Set breakpoint in component render:
   console.log(props.session);

4. Refresh page (F5, not Ctrl+Shift+R)

5. Inspect logged session object
```

**Assertions**:
- [ ] Session object contains all required fields:
  ```javascript
  {
    user: {
      id: "user_xxx",
      email: "test@example.com",
      name: "Test User",
      image: "avatar_url" // or null
    },
    expires: "2026-05-27T...",
    organizationId: "org_xxx",
    organizationName: "Test Org"
  }
  ```
- [ ] No extra/deprecated fields (backward compat check)
- [ ] Expires timestamp is future date (not expired)
- [ ] User.id matches database record

**Cross-Check Steps**:
```
1. Compare with database:
   - SELECT * FROM Account WHERE id = "user_xxx"
   - SELECT * FROM User WHERE accountId = "..."

2. Verify no stale data:
   - Session timestamp = current time (not cached from 1 hour ago)
   - Organization name matches latest DB value
```

---

### P0.4: Multiple Concurrent Requests
**Objective**: Verify no session data race conditions or partial delivery

**Environment**: Local dev, Network throttling enabled
**Steps**:
```
1. DevTools → Network tab → Set throttling: "Slow 3G"

2. Log in and immediately click multiple buttons:
   - Click "Dashboard" link
   - Click "Settings" link
   - Click "Contacts" link
   (all within 2 seconds)

3. Monitor console & Network tab for 10 seconds

4. Verify all pages receive consistent session data
```

**Assertions**:
- [ ] All pages show same user name (no mismatches)
- [ ] No "session undefined" errors on any page
- [ ] No race condition where one page shows old user, another shows new
- [ ] All XHR requests include auth header (if applicable)

**Edge Case - Rapid Navigation**:
```
1. Click through 5 different pages rapidly (< 5 seconds)
2. Go back to Dashboard
3. Verify:
   - [ ] User info still correct
   - [ ] No stale data shown
   - [ ] No loading spinners stuck
```

---

## 🎨 P1: User Experience (HIGH PRIORITY)

### P1.1: No Auth UI Flicker
**Objective**: Verify smooth UX with zero "undefined" → "name" transitions

**Environment**: Local dev, clean state
**Steps**:
```
1. Open browser DevTools (F12)

2. Go to Console tab, enable:
   - ✅ Errors
   - ✅ Warnings
   - ✅ Logs

3. Hard refresh page (Ctrl+Shift+R)

4. Watch page render for 5 seconds

5. Record any visual flicker:
   - Blank header where user name should be
   - "undefined" text appearing then disappearing
   - Sidebar collapsing/expanding
   - Avatar image not loading
```

**Assertions**:
- [ ] NO visual flicker on initial load
- [ ] User name appears on first render (not blank → filled)
- [ ] Avatar loads along with name (not separately)
- [ ] Sidebar shows stable org name immediately
- [ ] No bouncing/layout shift when user data renders

**Measurement** (Performance):
```javascript
// Run in console on page load:
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});
observer.observe({ entryTypes: ['measure'] });

// Measure from start to first render with auth:
performance.mark('auth-visible');
```

**Expected**: Auth data visible by 800ms (vs old 1200ms with extra /api/auth/me call)

---

### P1.2: Login → Dashboard Transition
**Objective**: Verify smooth post-login experience without flicker

**Environment**: Local dev
**Steps**:
```
1. Navigate to login page

2. Enter valid credentials:
   Email: test@example.com
   Password: ••••••••

3. Click "Sign In"

4. Observe page transitions for 3 seconds

5. Check for:
   - Spinner duration
   - Redirect timing
   - Final dashboard render
```

**Assertions**:
- [ ] Loading spinner shows immediately (< 200ms)
- [ ] Spinner duration: 2-4 seconds (normal auth time)
- [ ] NO blank white screen during transition
- [ ] Dashboard content loads progressively (not all-at-once)
- [ ] User name appears before table/grid data
- [ ] NO "undefined" text at any point

**Timeline Expected**:
```
0ms:    Click "Sign In"
100ms:  Loading spinner visible
1500ms: Redirect to /dashboard
2000ms: HTML received, start rendering
2400ms: Auth props injected, header renders
2600ms: User name visible ✅
3000ms: Dashboard content visible
```

---

### P1.3: Logout Flow
**Objective**: Verify clean session cleanup, no stale data

**Environment**: Local dev, logged-in state
**Steps**:
```
1. Log in to dashboard

2. Open user menu (top-right avatar)

3. Click "Logout"

4. Monitor console & DOM for 3 seconds

5. Verify cleanup
```

**Assertions**:
- [ ] Logout button triggers immediately (no delay)
- [ ] Redirected to login page within 1-2 seconds
- [ ] User name/avatar removed from header
- [ ] No console errors about "undefined session"
- [ ] No residual user data in localStorage/sessionStorage:
  ```javascript
  // Run in console after logout:
  console.log(localStorage); // Should be empty or session-free
  console.log(sessionStorage);
  ```
- [ ] Previous page shows login page, not cached dashboard
- [ ] Cannot navigate back to dashboard (session invalid)

**Back Button Test**:
```
1. Log in
2. Click logout
3. Press browser back button
4. Verify:
   - [ ] Login page still shown (not dashboard)
   - [ ] New GET request made to /login
   - [ ] No cached dashboard visible
```

---

### P1.4: Multiple Browser Tabs (Session Consistency)
**Objective**: Verify same user appears in all tabs, no duplication of auth calls

**Environment**: Local dev
**Steps**:
```
1. Open DevTools in Tab A, Network tab

2. Log in in Tab A, observe network calls

3. Open new tab (Tab B)

4. Navigate to same app URL in Tab B

5. Compare:
   - User name displayed in both tabs
   - Network calls made in each tab
   - Total calls for both tabs
```

**Assertions**:
- [ ] Both tabs show same user name
- [ ] Both tabs show same organization
- [ ] Tab B does NOT make new /api/auth/me call (uses cached props)
- [ ] Total calls: ~3 (A) + ~2 (B) = ~5, NOT 4+4=8
- [ ] Logout in Tab A:
  - [ ] Tab A: Redirected to login ✅
  - [ ] Tab B: Still shows dashboard (expected for current impl)
     - (Optional: Could show "session expired" overlay as P1 improvement)

**Expected Network Pattern**:
```
Tab A (Initial):
  ✅ /api/auth/signin (POST)
  ✅ /api/auth/callback (GET)
  ✅ /dashboard (GET) - with embedded session

Tab B (Subsequent):
  ✅ /dashboard (GET) - reuses Tab A's session via cookies
  ❌ NO /api/auth/me call

Savings: 1 auth call per new tab = 200ms faster load
```

---

### P1.5: Permission Changes (Admin Updates User)
**Objective**: Verify permission changes visible after refresh

**Environment**: Two browser windows (user A + admin B)
**Steps**:
```
1. Window A: Log in as regular user (test@example.com)
   - Note current role/permissions shown

2. Window B: Log in as admin (admin@example.com)
   - Navigate to User Management

3. Window B: Change User A's role from "Editor" → "Viewer"

4. Window A: Refresh page (F5)

5. Check if new permission reflected
```

**Assertions**:
- [ ] New role visible in Window A after refresh
- [ ] UI features restricted based on new role:
  - [ ] Edit buttons hidden (if "Viewer" role)
  - [ ] Settings pages inaccessible (if "Viewer" role)
- [ ] No API 403 errors when trying old-role actions
- [ ] Permission cache TTL respected (5 min default):
  - [ ] Change at 12:00:00
  - [ ] Visible by 12:00:30 (within 30 seconds after refresh)

**TTL Verification** (if permission caching is implemented):
```
1. Change permission in admin panel: 12:00:00
2. Refresh user page immediately: 12:00:05
   - Expected: OLD permission still shown (cache not expired)
   - OR: NEW permission shown (cache invalidated)
3. Refresh again after 5 minutes: 12:05:00
   - Expected: NEW permission shown
```

---

## 🚨 P2: Error Handling (MUST NOT BREAK)

### P2.1: Invalid/Expired Session
**Objective**: Verify graceful handling when session is invalid

**Environment**: Local dev, with session manipulation
**Steps**:
```
1. Log in normally

2. DevTools → Application → Cookies → [auth_token_cookie]

3. Modify cookie value (change 1 character)

4. Refresh page

5. Observe error handling
```

**Assertions**:
- [ ] NO blank white screen
- [ ] NO 500 error page
- [ ] NO console errors with stack traces
- [ ] One of these acceptable behaviors:
  - [ ] A) Redirect to login page with message
       "Session expired. Please log in again."
  - [ ] B) Show error message:
       "Authentication failed. Refreshing..."
       (then auto-redirect to login)
  - [ ] C) Show login overlay over dashboard
       (user can re-enter credentials)

**Console Should Show**:
```javascript
// ✅ Acceptable:
console.log("Session validation failed, redirecting to login");

// ❌ NOT Acceptable:
console.error("Cannot read property 'user' of undefined");
console.error("Unhandled promise rejection: 401 Unauthorized");
```

---

### P2.2: Missing Session Cookie
**Objective**: Verify behavior when session cookie is absent

**Environment**: Local dev
**Steps**:
```
1. Log in normally

2. Delete auth session cookie:
   DevTools → Application → Cookies → [session_cookie] → Delete

3. Refresh page

4. Try to navigate to protected page
```

**Assertions**:
- [ ] Redirected to login page (not error page)
- [ ] No 401/403 errors in console (handled gracefully)
- [ ] No "undefined session" errors
- [ ] Login page loads normally

**Edge Case - Cookie Manually Cleared While Logged In**:
```
1. Logged in, viewing dashboard
2. Open dev console: Delete session cookie
3. Click any button/link
4. Verify:
   - [ ] Error message shown (not white screen)
   - [ ] Redirect to login triggered
   - [ ] No API 401 spam (only 1-2 calls, not 10+)
```

---

### P2.3: Server Error - Session Fetch Fails
**Objective**: Verify fallback behavior when server can't read session

**Environment**: Local dev with mocked server error
**Steps**:
```
// In browser console, simulate server error:
1. Set fetch interceptor (see below)
2. Refresh page
3. Observe error handling

// Simulated code (Playwright/Puppeteer):
await page.route('**/api/auth/session', route => {
  route.abort('failed'); // Simulate network error
});
```

**Assertions**:
- [ ] Page does NOT go completely blank
- [ ] One of these acceptable outcomes:
  - [ ] Show error message: "Unable to load session. Retrying..."
  - [ ] Show login page with message: "Connection error"
  - [ ] Show cached dashboard (degraded mode)
  - [ ] Show offline message (if offline)

**Error Message Requirements**:
- [ ] Message is user-friendly (not technical jargon)
- [ ] Message does NOT expose server stack trace
- [ ] Has retry button or auto-retry (within 5 seconds)
- [ ] Doesn't show "null" or "undefined"

---

### P2.4: Partial Session Data (Missing Fields)
**Objective**: Verify UI doesn't break if session fields are missing

**Environment**: Local dev with mocked incomplete session
**Steps**:
```javascript
// Simulate incomplete session in DevTools console:
// (requires component to be inspectable)

// Scenario A: Missing user.name
session = { user: { id: 'x', email: 'test@example.com' } }

// Scenario B: Missing organizationName
session = { user: {...}, organizationId: 'org_1' }

// Scenario C: Missing expires
session = { user: {...}, organizationId: 'org_1' }
```

**Assertions**:
- [ ] No console errors for missing properties
- [ ] UI shows fallback values:
  - [ ] Missing name → Show email or "User"
  - [ ] Missing org name → Show "Organization" or org ID
  - [ ] Missing expires → Show session as active (or fade out after TTL)
- [ ] Page still functional (can click buttons, navigate)

**Code Pattern** (Expected safe pattern):
```typescript
// ✅ Safe:
<span>{session?.user?.name || session?.user?.email || 'User'}</span>

// ❌ Unsafe (will error if name is undefined):
<span>{session.user.name}</span>
```

---

## ⚡ P3: Performance Optimization

### P3.1: Network Calls Reduction
**Objective**: Verify /api/auth/me call is eliminated

**Environment**: Local dev, Network tab open
**Steps**:
```
1. Clear cache: Ctrl+Shift+Del (Chrome DevTools)

2. Open Network tab, set filter: "XHR"

3. Hard refresh dashboard page

4. Record all calls in first 5 seconds

5. Compare with old implementation
```

**Expected New Pattern**:
```
✅ Call 1: GET /dashboard (300ms) - HTML with embedded session
✅ Call 2: GET /api/contacts (100ms) - API data
✅ Call 3: GET /api/organizations (50ms) - Org data

❌ Call removed: GET /api/auth/me (200ms previously)

Total: 450ms (vs 650ms previously)
Improvement: 30% faster
```

**Measurement**:
```javascript
// Run in console after page load:
const calls = performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/api/auth'));

console.log(`Auth API calls: ${calls.length}`);
// Expected: 0 (was 1 before optimization)
```

**Waterfall Analysis**:
```
Before (old /api/auth/me approach):
├─ HTML (1200ms) ─┐
├─ CSS (800ms)    ├─ Parallel
├─ JS (600ms)  ───┤
└─ /api/auth/me (starts at 400ms, blocks auth display)
   └─ Finish 600ms
   
After (props approach):
├─ HTML (1200ms) ───┐ Session embedded, renders immediately
├─ CSS (800ms)      ├─ Parallel
├─ JS (600ms)   ────┤
└─ [no /api/auth/me]

Result: Auth visible by 1200ms (vs 1600ms), 25% faster
```

---

### P3.2: Time to Interactive (TTI) Improvement
**Objective**: Verify faster page interactivity without auth call

**Environment**: Local dev, Lighthouse
**Steps**:
```
1. Open DevTools → Lighthouse tab

2. Run audit:
   - [ ] Mobile
   - [ ] Desktop

3. Record TTI metric:
   Before implementation: ~3.2s
   After implementation: <2.8s (target)

4. Save report
```

**Expected Results**:
| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| LCP | 1.8s | 1.8s | <2.5s | ✅ |
| FCP | 1.2s | 1.2s | <1.8s | ✅ |
| TTI | 3.2s | 2.8s | <3.0s | ✅ |
| CLS | 0.08 | 0.08 | <0.1 | ✅ |
| INP | 95ms | 90ms | <100ms | ✅ |

**Pass Criteria**:
- [ ] TTI improves by 10-20% (200-600ms faster)
- [ ] No regression in other metrics
- [ ] Performance score >= 90

---

### P3.3: Slow Network (3G Throttling)
**Objective**: Verify graceful degradation on slow networks

**Environment**: Local dev with throttling
**Steps**:
```
1. DevTools → Network → Throttling: "Slow 3G"

2. Hard refresh page

3. Observe loading progression

4. Time measurements:
   - Time to first render: ___ms
   - Time to auth visible: ___ms
   - Time to interactive: ___ms
```

**Assertions**:
- [ ] Page shows loading state immediately (< 500ms)
- [ ] Content renders progressively (not all-or-nothing)
- [ ] Auth data visible before heavy data (tables, charts)
- [ ] No white blank screen at any point
- [ ] Total load time: < 8 seconds

**Timeline Expected on 3G**:
```
0s:    Page starts loading
0.5s:  Loading spinner visible
2.5s:  Auth data + header visible
4.5s:  Table data starts appearing
5.5s:  Page interactive (can click buttons)
7.0s:  All data loaded
```

---

## 🔒 P4: Security

### P4.1: Session Data Not Exposed in DOM
**Objective**: Verify sensitive data not visible in HTML source

**Environment**: Local dev, logged in
**Steps**:
```
1. Right-click page → "View Page Source"

2. Search for sensitive data:
   - Ctrl+F: "password" → Should be 0 results
   - Ctrl+F: "token" → Should be 0 results (unless needed)
   - Ctrl+F: email → Should be visible (not sensitive)
   - Ctrl+F: userId → Should be visible (not sensitive)

3. Check for API key exposure:
   - Ctrl+F: "sk_" or "pk_" or "api_key" → 0 results expected

4. Check DevTools → Sources → Page → Script tags
   - Look for hardcoded credentials
```

**Assertions**:
- [ ] NO password hashes in HTML
- [ ] NO API keys/secrets in page source
- [ ] NO plain-text auth tokens in HTML (use HTTP-only cookies instead)
- [ ] User email/ID visible (OK, not sensitive)
- [ ] Organization name visible (OK, not sensitive)

**Expected Safe Pattern**:
```html
<!-- ✅ Safe: Session data minimal in HTML -->
<div class="user-header">
  <span>John Doe</span>  <!-- OK: public user name -->
  <span>Org Inc.</span>   <!-- OK: public org name -->
</div>

<!-- ❌ Unsafe: Auth token exposed -->
<div data-token="abc123xyz...">...</div>
```

---

### P4.2: XSS Protection
**Objective**: Verify session data is sanitized, no XSS vectors

**Environment**: Local dev with malicious input
**Steps**:
```
1. Create test user with XSS payload in name:
   Name: <img src=x onerror=alert('XSS')>

2. Log in as admin

3. Add this user to organization

4. View user list in dashboard

5. Check if alert() is triggered
```

**Assertions**:
- [ ] NO JavaScript alert() popup
- [ ] Payload shown as escaped text:
   `&lt;img src=x onerror=alert('XSS')&gt;`
- [ ] Browser console shows NO JavaScript execution
- [ ] Same check for organization name with XSS payload

**Code Pattern** (Expected):
```typescript
// ✅ Safe (React auto-escapes):
<span>{session.user.name}</span>

// ❌ Unsafe (HTML injection possible):
<span dangerouslySetInnerHTML={{__html: session.user.name}} />
```

---

### P4.3: Session Hijacking Prevention
**Objective**: Verify session can't be hijacked via cookie theft

**Environment**: Local dev, simulated attack
**Steps**:
```
1. Log in normally

2. Copy session cookie value:
   DevTools → Application → Cookies → [session_cookie] → Copy Value

3. Open incognito/private window

4. Open DevTools → Console

5. Paste cookie:
   document.cookie = "[copied_cookie_value]"

6. Refresh page

7. Check if logged in as original user
```

**Assertions**:
- [ ] Option A (Best): Incognito window still shows login page
       (because other session markers like IP/user-agent don't match)
- [ ] Option B: Session detected as suspicious, force re-auth
- [ ] Option C: Incognito window shows logged-in state (acceptable for same device)
       (should verify via: same IP, same user-agent, same device ID)

**Expected Behavior**:
```
Normal login: Session cookie + HttpOnly flag + Secure flag + SameSite=Strict
Hijack attempt: Missing other validation markers → Reject or warn
```

---

### P4.4: CSRF Protection
**Objective**: Verify logout/sensitive actions are CSRF-protected

**Environment**: Local dev
**Steps**:
```
1. Log in to dashboard

2. Open another tab with attacker site (localhost:3001)

3. In console on attacker site, try to trigger logout:
   fetch('http://localhost:3000/api/auth/signout', {
     method: 'POST',
     credentials: 'include'
   })

4. Check if logout succeeds
```

**Assertions**:
- [ ] Logout fails (403 Forbidden) if CSRF token not provided
- [ ] Original tab still shows logged in (logout didn't work)
- [ ] No error message leaked to attacker site (no info disclosure)

**Expected CSRF Implementation**:
```typescript
// ✅ POST with CSRF token:
const response = await fetch('/api/auth/signout', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken  // Required
  },
  credentials: 'include'
});

// ❌ Vulnerable (no token):
const response = await fetch('/api/auth/signout', {
  method: 'POST',
  credentials: 'include'  // Can be CSRF'd
});
```

---

## 🌐 P5: Browser Compatibility

### P5.1: Desktop Browsers
**Objective**: Verify consistent behavior across major desktop browsers

**Environment**: Latest stable versions
**Browsers to Test**:
- [ ] Chrome 125+
- [ ] Firefox 126+
- [ ] Safari 17+
- [ ] Edge 125+

**Test Steps** (same for each browser):
```
1. Open browser in fresh profile (no extensions)

2. Navigate to login page

3. Log in with test credentials

4. Verify:
   - [ ] Login succeeds
   - [ ] User name displays correctly
   - [ ] Dashboard renders without errors
   - [ ] Console shows NO errors
   - [ ] Page interactive within 3 seconds
```

**Browser-Specific Checks**:
```
Chrome:
  [ ] Cookie handling (third-party cookies disabled scenario)
  [ ] DevTools shows correct network timeline
  [ ] Performance metrics accurate

Firefox:
  [ ] No tracking protection conflicts
  [ ] Console shows no warnings
  [ ] Redirect chain handled correctly

Safari:
  [ ] HttpOnly cookies work correctly
  [ ] No Intelligent Tracking Prevention (ITP) issues
  [ ] Session persists across pages

Edge:
  [ ] Identical to Chrome (uses Chromium)
  [ ] No IE-specific issues
```

**Expected Result**: Consistent behavior in all browsers

---

### P5.2: Mobile Browsers
**Objective**: Verify mobile-specific session handling

**Environment**: Real devices or emulators
**Devices to Test**:
- [ ] iOS Safari (iPhone 14/15+)
- [ ] Chrome Android (Pixel 8)
- [ ] Samsung Internet

**Test Steps**:
```
1. Open browser on mobile device

2. Scan QR code or enter URL to login page

3. Log in with test credentials

4. Navigate through dashboard

5. Leave app, close browser, re-open (simulates app backgrounding)

6. Verify session still valid
```

**Mobile-Specific Assertions**:
- [ ] Safe Area respected (notch doesn't cover content)
- [ ] Touch targets >= 44px (WCAG)
- [ ] Scroll performance smooth (no janky frame drops)
- [ ] Session persists after app backgrounding
- [ ] No memory leaks (app doesn't crash after 5 minutes usage)
- [ ] Touch gestures work (pull-to-refresh, swipe-back)

**iOS-Specific**:
```
[ ] Test on iOS 15+ (for ITP 2.3 changes)
[ ] Verify session cookie in Private Browsing mode
[ ] Check Safari app extensions don't interfere
[ ] Test in-app browser (Instagram, Facebook links)
```

---

### P5.3: Cross-Device Session (Desktop → Mobile)
**Objective**: Verify session state consistent across device types

**Environment**: Real devices (desktop + mobile)
**Steps**:
```
1. Desktop: Log in to dashboard

2. Mobile: Scan QR code to same app

3. Mobile: Should show login page OR logged-in state
   (depending on cookie sharing policy)

4. Verify consistency:
   - Same user in both devices
   - Same organization
   - Logout in one doesn't affect other (expected)
```

**Assertions**:
- [ ] Both devices show correct user if logged in
- [ ] Session data consistent (same organization, same role)
- [ ] Logout in desktop doesn't auto-logout mobile
   (acceptable, as they're separate session cookies)

---

## ✅ P0-5 Rollout Checklist (Sign-Off)

### Pre-Deployment Validation
Agent γ must verify before greenlight:

**P0: Auth Flow**
- [ ] No /api/auth/me calls detected in Network tab
- [ ] Session props properly typed in TypeScript
- [ ] Session data integrity verified (fresh from server)
- [ ] Multiple concurrent requests handled safely
- [ ] Build succeeds with `npm run build` (0 errors)

**P1: UX**
- [ ] No flicker observed during login/page navigation
- [ ] Logout cleans up session properly
- [ ] Multi-tab scenario consistent (no duplication)
- [ ] Permission changes visible after refresh
- [ ] Performance: TTI < 3.0s (improvement vs before)

**P2: Errors**
- [ ] Invalid/expired session handled gracefully
- [ ] Missing session cookie redirects to login (not error page)
- [ ] Server errors show user-friendly messages (no stack traces)
- [ ] Partial session data doesn't break UI

**P3: Performance**
- [ ] Network calls reduced by ~200ms (one /api/auth/me eliminated)
- [ ] Lighthouse score >= 90 (no regression)
- [ ] Slow 3G loads without blank screens
- [ ] TTI improvement of 10-20% measured

**P4: Security**
- [ ] No sensitive data in HTML source
- [ ] XSS payloads properly escaped
- [ ] Session hijacking mitigated (session markers validated)
- [ ] CSRF protection on logout/sensitive endpoints

**P5: Compatibility**
- [ ] Tested on: Chrome, Firefox, Safari, Edge (desktop)
- [ ] Tested on: iOS Safari, Chrome Android (mobile)
- [ ] Consistent behavior across all browsers
- [ ] No console errors on any browser

---

## 📊 Regression Testing (Post-Deployment, 24-Hour Window)

### Automated Monitoring
**Metrics to Track** (1st 24 hours):

| Metric | Baseline | Alert Threshold | Status |
|--------|----------|-----------------|--------|
| 401/403 errors | <0.5%/min | >1%/min | 🔴 STOP |
| Page blank screens | 0/day | >2 reports | 🔴 STOP |
| TTI regression | Baseline | >20% slower | 🔴 STOP |
| Auth call count | 0 | >5% of pages | 🔴 STOP |
| Support tickets | 0 | >1 auth-related | 🔴 INVESTIGATE |

### Manual Spot Checks (Every 4 hours for 24h)

**Checklist** (repeat 4x):
```
08:00 - Spot check 1:
  [ ] Log in fresh (clear cookies)
  [ ] Check Network tab (no /api/auth/me)
  [ ] Verify user name displays
  [ ] Check console (no errors)

12:00 - Spot check 2:
  [ ] Log in, then logout
  [ ] Verify session cleanup
  [ ] Navigate to protected page
  [ ] Confirm redirect to login

16:00 - Spot check 3:
  [ ] Log in on multiple tabs
  [ ] Verify consistent user display
  [ ] Check for duplicate auth calls
  [ ] Confirm tab consistency

20:00 - Spot check 4:
  [ ] Try invalid session (delete cookie)
  [ ] Verify graceful error handling
  [ ] Check error message clarity
  [ ] Confirm redirect to login
```

### Rollback Criteria
**IMMEDIATELY ROLLBACK if any of these occur**:

- [ ] **P0 BLOCKER**: /api/auth/me call appears in Network tab
      (Props not populated, indicates implementation failure)
      ```bash
      git revert <commit-hash> --no-edit
      git push origin main
      ```

- [ ] **P0 BLOCKER**: TypeScript build fails in CI/CD
      ```bash
      # Verify locally first
      npm run build
      ```

- [ ] **P1 BLOCKER**: >5 support tickets about blank pages or login loops
      (Indicates UX regression affecting users)

- [ ] **P3 BLOCKER**: TTI regresses by >20% in Lighthouse
      (Performance optimization not achieved)

- [ ] **P4 BLOCKER**: XSS vulnerability found in session data display
      (Security regression, immediate patch required)

- [ ] **P5 BLOCKER**: >2 browsers report broken authentication
      (Compatibility issue preventing logins)

**Rollback Commands**:
```bash
# If rollback needed:
git log --oneline -5  # Find commit hash
git revert <hash> --no-edit
npm run build
npm run test  # Verify no new errors
git push origin main

# Notify team:
# Slack: "Rolled back commit <hash> due to [REASON]"
```

---

## 🎓 Testing Scenarios by User Type

### Scenario A: New User (Never Logged In)
```
1. Clear all cookies/cache
2. Visit /login
3. Verify login page appears (not dashboard)
4. Enter credentials
5. Verify redirect to dashboard with user name
6. Expected network calls: 3-4 (no /api/auth/me)
```

### Scenario B: Returning User (Cookies Still Valid)
```
1. Close browser, reopen
2. Visit /dashboard directly
3. Verify dashboard loads with user name (no login page)
4. Expected network calls: 1-2 (HTML + data, no login)
```

### Scenario C: Returning User (Cookies Expired)
```
1. Close browser overnight
2. Visit /dashboard next day
3. Verify redirect to /login
4. Enter credentials again
5. Verify dashboard loads
6. Expected: Clean re-auth, no stale data
```

### Scenario D: Power User (Many Tabs + Rapid Navigation)
```
1. Log in
2. Open 5 new tabs to app
3. Navigate rapidly between tabs
4. Verify:
   - [ ] No duplicate auth calls
   - [ ] Consistent user data
   - [ ] No race conditions
5. Expected: Each tab reuses session from Tab 1
```

### Scenario E: Admin (Permission Changes While User is Logged In)
```
1. User A: Log in as editor
2. Admin: Change User A to viewer
3. User A: Refresh page
4. Verify: New permission visible
5. Test: Attempt to edit (should be blocked)
```

---

## 🐛 Known Issues & Workarounds

### Issue 1: Third-Party Cookies Disabled
**Symptom**: Session cookie not persisted on some sites

**Root Cause**: Browser privacy setting blocks third-party cookies (Safari ITP 2.3+)

**Workaround**:
- Use SameSite=None + Secure flag for cross-origin requests
- Or: Use first-party cookies only (most secure)

**Test Command**:
```bash
# Verify SameSite flag in cookies:
# DevTools → Application → Cookies → [session] → SameSite property
```

---

### Issue 2: Slow Network Timeout
**Symptom**: Page never loads on very slow networks (< 50kb/s)

**Root Cause**: HTML + props bundle too large, timeout before complete

**Workaround**:
- Implement timeout (15-30 seconds) with fallback to API call
- Or: Stream HTML progressively (Server Components with Suspense)

**Test Command**:
```bash
# Simulate very slow network:
DevTools → Network → Throttling: "Slow 3G" (50kb/s)
```

---

### Issue 3: Session Props Not Updated After Permission Change
**Symptom**: User still sees old permissions until hard refresh

**Root Cause**: Props cached for 5 minutes, permission change not reflected

**Workaround**:
- Implement cache invalidation on permission change
- Or: Add manual refresh button for urgent cases
- Or: Reduce cache TTL to 1 minute

**Verification**:
```
Timeline:
  12:00:00 - Permission changed in admin panel
  12:00:05 - User A refreshes page
  Expected: NEW permission shown (or marked as "cached, expires in 4:55")
```

---

## 📞 Support Escalation

### Tier 1: Agent γ QA Findings
If any P0-P5 assertion fails:

1. **Document**: Screenshot + network log + console errors
2. **Investigate**: 2-minute root cause analysis
3. **Report to Agent α**: "P1 flicker observed on login page"
4. **Recommendation**: "Reduce animation duration" OR "Move auth data earlier in render"

### Tier 2: Agent α Backend Issues
If root cause is server-side (auth endpoint, props generation):

1. **Pass to Agent α**: Server Component implementation review
2. **Verify**: `await getSession()` properly called in layout.tsx
3. **Fix**: Ensure session passed as prop to all child components

### Tier 3: Agent β API Optimization
If root cause is API performance (slow data fetch):

1. **Pass to Agent β**: Query optimization
2. **Verify**: Database queries are cached/indexed
3. **Optimize**: Reduce N+1 queries, use batch loading

---

## 🚀 Final Sign-Off

**Agent γ QA Sign-Off Template**:

```markdown
## QA Testing Complete - [DATE]

### P0: Auth Flow
- [x] No /api/auth/me calls
- [x] Session props typed safely
- [x] Data integrity verified

### P1: UX
- [x] No flicker observed
- [x] Login flow smooth
- [x] Logout clean

### P2: Errors
- [x] Graceful error handling
- [x] No blank pages
- [x] User-friendly messages

### P3: Performance
- [x] TTI improved 15%
- [x] Network calls reduced 1
- [x] Lighthouse 92/100

### P4: Security
- [x] No XSS vectors
- [x] Session data sanitized
- [x] CSRF protected

### P5: Compatibility
- [x] All desktop browsers OK
- [x] All mobile browsers OK
- [x] Consistent cross-browser

### FINAL RESULT: ✅ APPROVED FOR DEPLOYMENT

**Signed by**: Agent γ  
**Date**: [YYYY-MM-DD]  
**Test Environment**: Production-like  
**Devices**: 5 browsers, 2 devices  
**Automated Tests**: 50+ passed  

**Rollback Criteria Understood**: YES
**Emergency Contact**: [Team Lead]
```

---

## 📎 Appendix: Tools & Commands

### DevTools Commands
```javascript
// Check for /api/auth/me calls:
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/api/auth'))
  .forEach(r => console.log(r.name, r.duration + 'ms'));

// Check session object:
// (In Server Component context, requires inspection)
console.log(JSON.stringify(window.__SESSION__, null, 2));

// Monitor for memory leaks:
console.memory // If available
// Or: Task Manager → Memory usage

// Simulate offline:
// DevTools → Network → Offline checkbox
```

### Automated Test Commands
```bash
# Run full QA suite:
npm run test:qa

# Test specific scenario:
npm run test -- --testNamePattern="P0.1"

# Generate Lighthouse report:
npx lighthouse https://localhost:3000 --view

# Check TypeScript:
npm run type-check

# Profile Network (HAR file):
npm run test:profile -- --har output.har
```

### Debugging Commands
```bash
# Enable verbose logging:
DEBUG=* npm run dev

# Check for console warnings:
npm run test -- --logHeapUsage

# Measure specific metric:
npm run test -- --collectCoverageFrom="src/**"
```

---

## 🎯 Success Criteria Summary

✅ **All P0-5 checklist items completed**
✅ **No regressions in UX/performance**
✅ **Security review passed**
✅ **Cross-browser compatibility verified**
✅ **Rollback plan understood and tested**
✅ **Team sign-off obtained**

**Status**: Ready for Production Deployment

---

**Document Version**: 1.0
**Last Updated**: 2026-05-20
**Maintained by**: Agent γ (QA)
**Next Review**: Post-deployment (24-hour window)
