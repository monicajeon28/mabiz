# API Authentication & Authorization Guide

This directory contains reusable authentication and authorization utilities for all API endpoints.

## Architecture

```
middleware.ts (injected headers)
    ↓
x-session-id, x-user-role, x-org-id, x-is-admin
    ↓
API endpoints
    ├─ validate-admin-role.ts → /api/admin/* endpoints
    ├─ validate-agent-role.ts → Team-level endpoints
    └─ auth-middleware.ts     → Reusable guards
```

### Auth Headers Injected by middleware.ts

All protected routes receive these headers:
- **x-session-id** (string) — Session ID for logging
- **x-user-role** (string) — Role: GLOBAL_ADMIN | OWNER | AGENT | FREE_SALES
- **x-org-id** (string) — Organization ID (empty for GLOBAL_ADMIN)
- **x-is-admin** (string) — 'true' | 'false'

## Usage Patterns

### Pattern 1: Simple Admin Check (Quick)

For `/api/admin/*` endpoints that only need GLOBAL_ADMIN:

```typescript
import { validateAdminRole } from '@/app/api/_auth/validate-admin-role';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Step 1: Validate admin role
  const roleCheck = validateAdminRole(req);
  if (roleCheck instanceof NextResponse) return roleCheck; // 403 Forbidden

  // Step 2: Proceed with logic
  // ...
}
```

### Pattern 2: Agent/Team Check (Quick)

For team-level endpoints (OWNER + AGENT):

```typescript
import { validateAgentRole } from '@/app/api/_auth/validate-agent-role';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Step 1: Validate agent role
  const roleCheck = validateAgentRole(req);
  if (roleCheck instanceof NextResponse) return roleCheck; // 403 Forbidden

  // Step 2: Proceed with logic
  // ...
}
```

### Pattern 3: Custom Guards (Flexible)

For complex authorization logic:

```typescript
import { createAuthGuard, getAuthHeaders } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';

// Define at module level
const requireOwner = createAuthGuard(['OWNER', 'GLOBAL_ADMIN'], {
  requireOrgId: true,
  errorMessage: '대리점장만 수정할 수 있습니다.',
});

export async function PATCH(req: NextRequest) {
  // Step 1: Apply custom guard
  const authCheck = requireOwner(req);
  if (authCheck instanceof NextResponse) return authCheck;

  // Step 2: Extract auth context
  const { userRole, orgId } = getAuthHeaders(req);

  // Step 3: Use org-specific logic
  // Filter queries by orgId to ensure data isolation
  // ...
}
```

### Pattern 4: Preset Guards (Most Common)

For standard scenarios, use preset guards from `auth-middleware.ts`:

```typescript
import { authGuards } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';

// Admin-only endpoint
export async function DELETE(req: NextRequest) {
  const authCheck = authGuards.adminOnly(req);
  if (authCheck instanceof NextResponse) return authCheck;
  // ...
}

// Owner-level endpoint
export async function PATCH(req: NextRequest) {
  const authCheck = authGuards.ownerOrAdmin(req);
  if (authCheck instanceof NextResponse) return authCheck;
  // ...
}

// Team member endpoint
export async function GET(req: NextRequest) {
  const authCheck = authGuards.teamMember(req);
  if (authCheck instanceof NextResponse) return authCheck;
  // ...
}
```

## Migration Strategy

### Phase 1: Admin Endpoints (/api/admin/*)
Use `validateAdminRole(req)` at line 1 of GET handler:

```typescript
// Before
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }
  // ...
}

// After
import { validateAdminRole } from '@/app/api/_auth/validate-admin-role';

export async function GET(req: NextRequest) {
  const roleCheck = validateAdminRole(req);
  if (roleCheck instanceof NextResponse) return roleCheck;

  // Remove old auth check — no longer needed
  // const ctx = await getAuthContext();
  // ...
}
```

### Phase 2-5: Team & Org Endpoints
Replace getAuthContext() calls with header-based checks:

```typescript
// Before
const ctx = await getAuthContext();
if (ctx.role !== 'OWNER') return forbidden();

// After
import { getAuthHeaders } from '@/lib/auth-middleware';

const { userRole, orgId } = getAuthHeaders(req);
if (userRole !== 'OWNER') return forbidden();
```

## Role Hierarchy

```
GLOBAL_ADMIN (manage all orgs)
  ├─ OWNER (manage own org + agents)
  │   └─ AGENT (assigned contacts only)
  └─ FREE_SALES (no contact DB access)
```

## Data Isolation Patterns

Always filter by orgId for org-specific endpoints:

```typescript
import { getAuthHeaders } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const { userRole, orgId } = getAuthHeaders(req);

  // GLOBAL_ADMIN can see all orgs
  // Others must be scoped to their orgId
  const where = userRole === 'GLOBAL_ADMIN'
    ? {}
    : { organizationId: orgId };

  const contacts = await prisma.contact.findMany({ where });
}
```

## Logging & Debugging

All auth violations are logged:

```typescript
// Automatically logged when using guard functions
const authCheck = authGuards.adminOnly(req);

// Logs to:
// [Auth Guard] Role check failed — endpoint, method, userRole, required roles, IP
```

## Best Practices

1. **Always validate at endpoint entry** — Don't rely on middleware alone
2. **Use headers over database calls** — Faster and works in edge runtime
3. **Log violations** — All failures automatically logged with IP/method
4. **Filter queries by orgId** — Even if user passes auth check
5. **Return consistent error format** — { ok: false, error, code }
6. **Test role combinations** — GLOBAL_ADMIN, OWNER, AGENT, FREE_SALES

## Next Steps (Wave 2-5)

- [ ] Migrate /api/admin/* routes (Phase 1)
- [ ] Migrate /api/dashboard/* routes (Phase 2)
- [ ] Migrate /api/contacts/* routes (Phase 3)
- [ ] Migrate /api/messages/* routes (Phase 4)
- [ ] Migrate /api/reports/* routes (Phase 5)
