# Wave 2 Readiness Checklist (Agent ε)
**Date:** 2026-05-20  
**Wave 1 Status:** ✓ COMPLETE AND VERIFIED

---

## Wave 1 → Wave 2 Transition Status

### Pre-Wave 2 Decisions Required

#### Decision 1: Legacy Validation Files
**Current state:**
- `src/app/api/_auth/validate-admin-role.ts` exists but unused
- `src/app/api/_auth/validate-agent-role.ts` exists but unused
- All endpoints now use `enforceRBAC()` from `_middleware/enforce-rbac.ts`

**Options:**
- **Option A (Recommended):** Delete both legacy files now, save them in git history
- **Option B:** Keep them as reference, mark as `@deprecated` in comments
- **Option C:** Migrate to `_middleware/enforce-rbac.ts` imports in any remaining code

**Recommendation:** Option A (delete them)

#### Decision 2: ProtectedLayout Implementation
**Current state:**
- `src/lib/protected-layout.tsx` created but not yet used in any pages
- All layouts use server-side `getMabizSession()` for protection

**Options:**
- **Option A:** Use ProtectedLayout for client-side pages that need role-based visibility
- **Option B:** Continue with server-side only (current approach)
- **Option C:** Hybrid - server validation + client-side components behind ProtectedLayout

**Recommendation:** Option C (hybrid - server validates, client-side components use ProtectedLayout)

#### Decision 3: Additional Protected Layouts
**Identified unprotected layouts:**
- dashboard/contacts/layout.tsx (should check authentication)
- dashboard/messages/layout.tsx (should check authentication)
- dashboard/settings/layout.tsx (should check authentication)
- dashboard/reports/layout.tsx (should check authentication)
- Any other dashboard subpages

**Recommendation:** Audit remaining layouts and add similar role checks

---

## Wave 2 Implementation Plan

### Phase 1: Code Cleanup (1-2 hours)

#### Task 1.1: Remove Legacy Files
```bash
git rm src/app/api/_auth/validate-admin-role.ts
git rm src/app/api/_auth/validate-agent-role.ts
git commit -m "chore: remove legacy validation functions (replaced by enforceRBAC)"
```

#### Task 1.2: Add Deprecation Warnings (if keeping files)
```typescript
/**
 * @deprecated Use enforceRBAC() from @/app/api/_middleware/enforce-rbac
 * This function will be removed in Wave 2
 */
export function validateAdminRole(req: NextRequest): true | NextResponse {
  // ...
}
```

---

### Phase 2: Additional Protection (2-3 hours)

#### Task 2.1: Audit Remaining Layouts
Check these files and add role validation:
- [ ] `src/app/(dashboard)/contacts/layout.tsx`
- [ ] `src/app/(dashboard)/messages/layout.tsx`
- [ ] `src/app/(dashboard)/settings/layout.tsx`
- [ ] `src/app/(dashboard)/reports/layout.tsx`
- [ ] `src/app/(dashboard)/groups/layout.tsx`
- [ ] `src/app/(dashboard)/campaigns/layout.tsx`
- [ ] Other dashboard subpaths

**Template for new layouts:**
```typescript
import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const metadata = {
  title: 'Page Title',
  description: 'Page description',
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await getMabizSession();

  // Validation logic
  if (!ctx) {
    logger.warn('layout: no session found');
    redirect('/sign-in');
  }

  // Add specific role checks as needed
  const validRoles = ['GLOBAL_ADMIN', 'OWNER', 'AGENT'];
  if (!validRoles.includes(ctx.role)) {
    logger.warn(`layout: unauthorized - role=${ctx.role}`);
    redirect('/dashboard');
  }

  return <>{children}</>;
}
```

#### Task 2.2: Add ProtectedLayout Wrappers to Pages
Identify pages that need client-side role checking and wrap them:
```typescript
'use client';

import { ProtectedLayout } from '@/lib/protected-layout';
import { useSession } from '@/hooks/use-session';

export default function AdminPage() {
  const { session } = useSession();

  return (
    <ProtectedLayout
      session={session}
      requiredRoles={['GLOBAL_ADMIN']}
      fallbackUrl="/dashboard"
      toastMessage="관리자 권한이 필요합니다."
    >
      {/* Page content */}
    </ProtectedLayout>
  );
}
```

---

### Phase 3: Testing & Validation (3-4 hours)

#### Task 3.1: Unit Tests for Middleware
```typescript
describe('middleware', () => {
  test('should inject x-user-role header for authenticated users', async () => {
    // Test header injection
  });

  test('should redirect to /login for unauthenticated users accessing protected routes', async () => {
    // Test redirect logic
  });

  test('should return 403 for non-admins accessing admin routes', async () => {
    // Test admin role check
  });
});
```

#### Task 3.2: Unit Tests for enforceRBAC
```typescript
describe('enforceRBAC', () => {
  test('should return true for authorized requests', () => {
    // Test with correct role
  });

  test('should return 403 NextResponse for unauthorized requests', () => {
    // Test with wrong role
  });

  test('should check organization boundaries', () => {
    // Test enforceRBACWithOrg
  });
});
```

#### Task 3.3: Integration Tests
```typescript
describe('auth integration', () => {
  test('middleware → layout → page should enforce permissions correctly', async () => {
    // Full request flow test
  });

  test('API endpoints should reject unauthorized calls', async () => {
    // API RBAC test
  });

  test('session expiration should redirect to login', async () => {
    // Session lifecycle test
  });
});
```

#### Task 3.4: E2E Tests (Playwright)
- [ ] Login → protected route → verify access
- [ ] Login as different roles → verify role-based access
- [ ] Expired session → verify redirect to login
- [ ] Direct API call without session → verify 401
- [ ] API call with wrong role → verify 403

---

### Phase 4: Documentation & Monitoring (1-2 hours)

#### Task 4.1: Update API Documentation
Add RBAC requirements to each endpoint:
```markdown
## GET /api/admin/organizations

**Authentication:** Required  
**Role:** GLOBAL_ADMIN  
**Error Responses:**
- 401: Missing auth headers
- 403: Insufficient permissions

### Headers
- x-session-id: Session identifier
- x-user-role: User role
- x-org-id: Organization ID
```

#### Task 4.2: Add Auth Monitoring
```typescript
// src/lib/monitoring/auth-monitor.ts
export function recordAuthEvent(
  event: 'login' | 'logout' | 'denied' | 'expired',
  metadata: { role?: string; endpoint?: string; reason?: string }
) {
  // Send to monitoring service
}
```

#### Task 4.3: Create Auth Integration Guide
Document for developers:
- How to protect a new layout
- How to protect an API endpoint
- How to check permissions in client code
- Common RBAC patterns

---

## Wave 2 Testing Matrix

### Middleware Testing
| Test Case | Input | Expected | Status |
|-----------|-------|----------|--------|
| Valid session | Cookie with session ID | Headers injected | [ ] |
| No session | No cookie | Redirect to /login | [ ] |
| Expired session | Expired session ID | Cookie deleted, redirect | [ ] |
| Admin route + non-admin | Non-admin role | 403 Forbidden | [ ] |
| Admin route + admin | Admin role | Headers injected, continue | [ ] |

### Layout Testing
| Test Case | Role | Route | Expected |
|-----------|------|-------|----------|
| Admin layout + GLOBAL_ADMIN | GLOBAL_ADMIN | /admin/* | Allowed |
| Admin layout + OWNER | OWNER | /admin/* | Redirect to /dashboard |
| Analytics layout + FREE_SALES | FREE_SALES | /dashboard/analytics | Redirect to /dashboard |
| Partner dashboard + AGENT | AGENT | /dashboard/partner-dashboard | Redirect to /dashboard |

### API Endpoint Testing
| Endpoint | No Session | Wrong Role | Correct Role |
|----------|-----------|-----------|--------------|
| GET /api/admin/organizations | 401 | 403 | 200 |
| GET /api/team/agents | 401 | 403 | 200 |
| POST /api/b2b | 401 | 403 | 200 |

---

## Wave 2 Deliverables Checklist

### Code Changes
- [ ] Delete/deprecate legacy validation files
- [ ] Add missing layout protections
- [ ] Implement ProtectedLayout in client pages
- [ ] Add monitoring/logging for auth events

### Testing
- [ ] Unit tests for middleware
- [ ] Unit tests for enforceRBAC
- [ ] Integration tests for auth flow
- [ ] E2E tests with Playwright
- [ ] Performance tests on middleware

### Documentation
- [ ] Update API docs with RBAC info
- [ ] Create developer guide for auth
- [ ] Document common RBAC patterns
- [ ] Add troubleshooting section

### QA & Validation
- [ ] Run full test suite
- [ ] Manual testing all protected routes
- [ ] Security review of RBAC implementation
- [ ] Performance baseline (middleware impact)

---

## Wave 2 Risk Assessment

### Low Risk
- ✓ Deleting legacy files (replaced by enforceRBAC)
- ✓ Adding more layout protections (same pattern as Wave 1)
- ✓ Unit testing middleware (isolated component)

### Medium Risk
- ⚠ Integration testing (requires database + session)
- ⚠ E2E testing (requires full environment)
- ⚠ Adding ProtectedLayout to existing pages (client-side routing changes)

### High Risk
- ⚠ Changing middleware matcher (could affect all routes)
- ⚠ Modifying session validation logic (auth breaks)

**Mitigation:** All high-risk changes should be tested in staging before production.

---

## Wave 2 Timeline Estimate

| Phase | Hours | Status |
|-------|-------|--------|
| Phase 1: Code Cleanup | 1-2h | Not started |
| Phase 2: Additional Protection | 2-3h | Not started |
| Phase 3: Testing | 3-4h | Not started |
| Phase 4: Docs & Monitoring | 1-2h | Not started |
| **Total** | **7-11h** | **Ready to start** |

---

## Approval for Wave 2

**Current Status:**
- Wave 1 verification complete ✓
- All code quality checks passed ✓
- No blockers identified ✓
- Ready for code review ✓

**Recommendations:**
1. Proceed with Wave 2 after code review approval
2. Prioritize testing phase (3-4 hours)
3. Consider staging environment testing before production
4. Document any new patterns discovered during testing

**Agent ε Sign-off:** APPROVED FOR WAVE 2
Date: 2026-05-20
