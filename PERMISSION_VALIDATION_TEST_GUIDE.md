# Permission Validation - Test Guide

## Overview

This guide helps verify that role-based permission validation is working correctly across all P2 pages.

---

## Test Environment Setup

### Prerequisites
- Test accounts with different roles pre-created
- Database seeded with test organizations and members
- Application running locally or in staging

### Test Accounts

| Role | Account | Org | Expected Access |
|------|---------|-----|-----------------|
| GLOBAL_ADMIN | admin@test.com | None | `/admin/*`, all P2 pages |
| OWNER | owner@test.com | org-1 | `/team/*`, `/payslips`, `/analytics`, `/partner-dashboard` |
| AGENT | agent@test.com | org-1 | `/team/*`, `/payslips`, `/analytics` |
| FREE_SALES | freelance@test.com | org-1 | `/dashboard` only |
| No Session | Not logged in | None | `/sign-in` only |

---

## Test Cases

### 1. Admin Pages (`/admin/*`)

#### 1.1 GLOBAL_ADMIN Access ✅
```
1. Log in as admin@test.com (GLOBAL_ADMIN)
2. Navigate to /admin/organizations
3. Expected: Page loads successfully
   - Page title shows "관리자"
   - Admin content renders
   - No redirects occur
```

#### 1.2 OWNER Blocked ❌
```
1. Log in as owner@test.com (OWNER)
2. Try to navigate to /admin/organizations
3. Expected: Redirect to /dashboard
   - URL changes to /dashboard
   - Admin page is NEVER loaded
   - Check logs for: "admin.layout: unauthorized access"
```

#### 1.3 AGENT Blocked ❌
```
1. Log in as agent@test.com (AGENT)
2. Try to navigate to /admin/partner-applications
3. Expected: Redirect to /dashboard immediately
   - Admin page content never visible
```

#### 1.4 FREE_SALES Blocked ❌
```
1. Log in as freelance@test.com (FREE_SALES)
2. Try to access /admin/backup-status
3. Expected: Redirect to /dashboard
   - No admin content visible
```

#### 1.5 No Session Blocked ❌
```
1. Clear all cookies/logout
2. Navigate to /admin/organizations
3. Expected: Redirect to /sign-in
   - User redirected to login page
   - Admin content never loads
```

---

### 2. Team Pages (`/team/*`)

#### 2.1 OWNER Access ✅
```
1. Log in as owner@test.com (OWNER)
2. Navigate to /team
3. Expected: Page loads successfully
   - Can see team metrics
   - Can see affiliate information
```

#### 2.2 AGENT Access ✅
```
1. Log in as agent@test.com (AGENT)
2. Navigate to /team/affiliate
3. Expected: Page loads successfully
   - Team information available
```

#### 2.3 GLOBAL_ADMIN Access ✅
```
1. Log in as admin@test.com (GLOBAL_ADMIN)
2. Navigate to /team
3. Expected: Page loads (GLOBAL_ADMIN can access all pages)
```

#### 2.4 FREE_SALES Blocked ❌
```
1. Log in as freelance@test.com (FREE_SALES)
2. Try to access /team
3. Expected: Redirect to /dashboard
   - Check logs for: "team.layout: unauthorized access"
```

---

### 3. Financial Pages (Payslips, Year-End, Statements)

#### 3.1 OWNER/AGENT Access ✅
```
1. Log in as owner@test.com (OWNER)
2. Navigate to /payslips
3. Expected: Page loads
   - Payslip list visible
   - Can see compensation data
```

#### 3.2 FREE_SALES Blocked ❌
```
1. Log in as freelance@test.com (FREE_SALES)
2. Try to access /payslips
3. Expected: Redirect to /dashboard
   - Sensitive financial data protected
```

#### 3.3 Year-End Report Access
```
1. Log in as owner@test.com (OWNER)
2. Navigate to /year-end-report
3. Expected: Page loads with tax data
```

#### 3.4 Statements Access
```
1. Log in as agent@test.com (AGENT)
2. Navigate to /statements
3. Expected: Page loads with sales data
```

---

### 4. Partner Dashboard

#### 4.1 OWNER/GLOBAL_ADMIN Access ✅
```
1. Log in as owner@test.com (OWNER)
2. Navigate to /partner-dashboard
3. Expected: Dashboard loads
   - Commission data visible
   - Agent status visible
```

#### 4.2 AGENT Blocked ❌
```
1. Log in as agent@test.com (AGENT)
2. Try to access /partner-dashboard
3. Expected: Redirect to /dashboard
   - Reason: AGENT cannot manage other agents
   - Check logs for unauthorized access
```

#### 4.3 FREE_SALES Blocked ❌
```
1. Log in as freelance@test.com (FREE_SALES)
2. Try to access /partner-dashboard
3. Expected: Redirect to /dashboard
```

---

### 5. Analytics Pages

#### 5.1 OWNER/AGENT Access ✅
```
1. Log in as agent@test.com (AGENT)
2. Navigate to /analytics/cost
3. Expected: Analytics loads
   - Cost charts visible
   - SMS/Email data shown
```

#### 5.2 FREE_SALES Blocked ❌
```
1. Log in as freelance@test.com (FREE_SALES)
2. Try to access /analytics/cost
3. Expected: Redirect to /dashboard
```

---

### 6. PNR Page (Special Case)

#### 6.1 Public Customer Access ✅
```
1. DO NOT log in
2. Navigate to /pnr/123 (where 123 is a valid reservation ID)
3. Expected: Public form loads
   - Phone verification step shown
   - No session required
   - Can enter phone number
```

#### 6.2 Authenticated AGENT Access ✅
```
1. Log in as agent@test.com (AGENT)
2. Navigate to /pnr/123
3. Expected: Fast path (skips phone verification)
   - PNR form loads directly
   - No phone verification needed
```

#### 6.3 Wrong Reservation Access ❌
```
1. Navigate to /pnr/99999 (non-existent)
2. Expected: Error message or 404
   - "예약 정보를 찾을 수 없습니다"
```

---

## Performance Tests

### Page Load Time
```
Metric: Time from request to content visible
Target: < 100ms for permission validation
Method:
  1. Open DevTools → Network tab
  2. Navigate to protected page
  3. Check DOMContentLoaded time
  4. Should see 1 DB query for session (cached after)
```

### Caching Behavior
```
Verification: Layouts are NOT cached per-request

1. Log in as owner@test.com (OWNER)
2. Navigate to /payslips → Loads ✅
3. User role changes in DB (manually to FREE_SALES)
4. Refresh /payslips
5. Expected: Redirect to /dashboard (NEW session validated)
   - Confirms validation happens every request
   - No stale cached permissions
```

---

## Log Verification

### Expected Log Entries

#### 1. Unauthorized Access Attempt
```
WARN: admin.layout: unauthorized access - role=OWNER, userId=user-123
```

#### 2. Missing Organization
```
WARN: team.layout: no organization - userId=user-456
```

#### 3. No Session
```
WARN: analytics.layout: no session found
```

### How to Check Logs
```bash
# In application logs
grep "unauthorized access" logs/app.log

# In database (if using logger table)
SELECT * FROM ExecutionLog 
WHERE level = 'WARN' 
  AND message LIKE '%unauthorized%'
ORDER BY createdAt DESC;
```

---

## API Authorization Tests

### Verify API Layer Also Protected

#### 1. Direct API Call (No Session)
```bash
curl -X GET http://localhost:3000/api/payslips
# Expected: 401 Unauthorized or 403 Forbidden
```

#### 2. API Call with FREE_SALES Token
```bash
# Get FREE_SALES token, then:
curl -X GET http://localhost:3000/api/partner-dashboard \
  -H "Authorization: Bearer FREE_SALES_TOKEN"
# Expected: 403 Forbidden
# OR FREE_SALES_NO_ACCESS error
```

#### 3. Data Filtering (AGENT Can Only See Own Data)
```bash
# As AGENT, call: GET /api/payslips
# Expected: Only returns payslips where agentId = logged-in user
# Verify: No other agent's payslips visible
```

---

## Regression Tests

### Check Existing Functionality Still Works

#### 1. Login Flow
```
1. Clear session
2. Navigate to /dashboard
3. Expected: Redirects to /sign-in
4. Log in successfully
5. Expected: Returns to /dashboard
```

#### 2. Logout Flow
```
1. Log in as owner
2. Navigate to /payslips
3. Click logout
4. Expected: Session cleared
5. Try to access /payslips
6. Expected: Redirect to /sign-in (not cached)
```

#### 3. Sidebar Navigation
```
1. Log in as agent
2. Check sidebar menu items
3. Expected: Only visible items are allowed
   - /team, /payslips, /analytics
   - /admin NOT shown
   - /partner-dashboard NOT shown
4. Direct URL navigation should redirect
```

---

## Checklist

### Pre-Test
- [ ] All test accounts created
- [ ] Test database ready
- [ ] Application running
- [ ] DevTools/network inspector ready
- [ ] Logs accessible

### During Tests
- [ ] Run through all test cases above
- [ ] Record any failures
- [ ] Check logs for each redirect
- [ ] Verify no unintended content leakage

### Post-Test
- [ ] Document any bugs found
- [ ] Create tickets for failures
- [ ] Performance within limits
- [ ] No regressions in existing flows
- [ ] Team notified of changes

---

## Troubleshooting

### Issue: Page not redirecting
**Cause**: Layout file syntax error or not deployed  
**Solution**: Check layout.tsx file exists and syntax is valid
```bash
npm run build  # Should compile without errors
```

### Issue: Infinite redirect loop
**Cause**: Role validation always fails or wrong fallback URL  
**Solution**: Check role list and fallback URLs
```typescript
// Verify role is correct
const validRoles = ['OWNER', 'AGENT']; // Check case sensitivity
const fallbackUrl = '/dashboard'; // Not the same page
```

### Issue: Logs not showing
**Cause**: Logger not configured or permission denied  
**Solution**: Check logger implementation
```typescript
import { logger } from '@/lib/logger';
logger.warn('message'); // Should appear in logs
```

### Issue: API still accessible without layout permission
**Cause**: API endpoints don't have authorization checks  
**Solution**: Add role checks to API handlers
```typescript
// In route handler
const ctx = await getAuthContext();
if (ctx.role !== 'OWNER') {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## Sign-Off

- [ ] All test cases passed
- [ ] No performance regressions
- [ ] Logs verified for security events
- [ ] API layer also protects data
- [ ] Ready for production deployment

**Tested by**: _____________  
**Date**: _____________  
**Notes**: _____________

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-20
