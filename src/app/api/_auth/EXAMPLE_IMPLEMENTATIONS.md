# Example API Endpoint Implementations

This document shows before/after patterns for updating endpoints to use the new auth guard system.

## Example 1: Admin-Only Endpoint

### Before (Using getAuthContext)

```typescript
// src/app/api/admin/affiliate-managers/route.ts
import { getAuthContext } from '@/lib/rbac';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // Database call just to check role
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    // ... rest of logic
  } catch (err) {
    logger.error('[GET /api/admin/affiliate-managers]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
```

### After (Using validateAdminRole)

```typescript
// src/app/api/admin/affiliate-managers/route.ts
import { validateAdminRole } from '@/app/api/_auth/validate-admin-role';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // 1. Check admin role (no database call)
    const roleCheck = validateAdminRole(req);
    if (roleCheck instanceof NextResponse) return roleCheck;

    // 2. Continue with logic
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    // ... rest of logic
  } catch (err) {
    logger.error('[GET /api/admin/affiliate-managers]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
```

**Benefits:**
- Faster (no DB call for auth)
- Cleaner code
- Consistent error responses
- Automatic logging

---

## Example 2: Team-Level Endpoint (Owner + Agent)

### Before (Mixed patterns)

```typescript
// src/app/api/dashboard/contacts/route.ts
import { getMabizSession } from '@/lib/auth';
import { buildContactWhere } from '@/lib/rbac';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getMabizSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Manual role check
  if (session.role === 'FREE_SALES') {
    return NextResponse.json({ error: 'No access' }, { status: 403 });
  }

  // Manual org filtering
  const where = buildContactWhere(session);
  const contacts = await prisma.contact.findMany({ where });

  return NextResponse.json({ ok: true, data: contacts });
}
```

### After (Using authGuards)

```typescript
// src/app/api/dashboard/contacts/route.ts
import { authGuards, getAuthHeaders } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  // 1. Check team member role
  const authCheck = authGuards.teamMember(req);
  if (authCheck instanceof NextResponse) return authCheck;

  // 2. Extract auth headers
  const { userRole, orgId } = getAuthHeaders(req);

  // 3. Build org-specific filter
  const where = userRole === 'GLOBAL_ADMIN'
    ? { deletedAt: null }
    : {
        organizationId: orgId,
        deletedAt: null,
        // Only show assigned contacts for AGENT
        ...(userRole === 'AGENT' && { assignedUserId: getAuthHeaders(req).sessionId }),
      };

  const contacts = await prisma.contact.findMany({ where });
  return NextResponse.json({ ok: true, data: contacts });
}
```

**Benefits:**
- Single guard validates role + orgId
- No database calls for auth
- Clear data isolation
- Handles all role combinations

---

## Example 3: Owner-Only Endpoint

### Before

```typescript
// src/app/api/organizations/[orgId]/settings/route.ts
import { getAuthContext } from '@/lib/rbac';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, props: { params: { orgId: string } }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orgId } = props.params;

  // Manual owner check
  if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Manual org isolation check
  if (ctx.role === 'OWNER' && ctx.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ... update logic
}
```

### After (Using custom guard)

```typescript
// src/app/api/organizations/[orgId]/settings/route.ts
import { createAuthGuard, getAuthHeaders } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';

// Define at module level
const requireOwner = createAuthGuard(['OWNER', 'GLOBAL_ADMIN'], {
  requireOrgId: true,
  errorMessage: '대리점장만 수정할 수 있습니다.',
});

export async function PATCH(req: NextRequest, props: { params: { orgId: string } }) {
  // 1. Check owner role + orgId
  const authCheck = requireOwner(req);
  if (authCheck instanceof NextResponse) return authCheck;

  const { orgId } = props.params;
  const { userRole, orgId: userOrgId } = getAuthHeaders(req);

  // 2. Extra org isolation check for OWNER (not needed for ADMIN)
  if (userRole === 'OWNER' && userOrgId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ... update logic
}
```

---

## Example 4: Role-Based Filtering in List Endpoint

### Pattern: GLOBAL_ADMIN sees all, OWNER sees own org, AGENT sees assigned

```typescript
// src/app/api/contacts/route.ts
import { authGuards, getAuthHeaders } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  // 1. Check role
  const authCheck = authGuards.teamMember(req);
  if (authCheck instanceof NextResponse) return authCheck;

  // 2. Extract auth
  const { userRole, orgId, sessionId } = getAuthHeaders(req);

  // 3. Build role-appropriate filter
  let where: any = { deletedAt: null };

  if (userRole === 'GLOBAL_ADMIN') {
    // See all contacts
    where = { deletedAt: null };
  } else if (userRole === 'OWNER') {
    // See org contacts
    where = { organizationId: orgId, deletedAt: null };
  } else if (userRole === 'AGENT') {
    // See assigned contacts
    where = {
      organizationId: orgId,
      assignedUserId: sessionId,
      deletedAt: null,
    };
  }

  const contacts = await prisma.contact.findMany({
    where,
    take: 100,
  });

  return NextResponse.json({ ok: true, data: contacts });
}
```

---

## Example 5: Endpoint with Multiple HTTP Methods

```typescript
// src/app/api/contacts/[id]/route.ts
import { authGuards, getAuthHeaders } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  // Only org members can read
  const authCheck = authGuards.teamMember(req);
  if (authCheck instanceof NextResponse) return authCheck;

  const { userRole, orgId } = getAuthHeaders(req);
  const id = new URL(req.url).pathname.split('/').pop();

  const contact = await prisma.contact.findUnique({
    where: { id: id! },
  });

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify org access
  if (userRole !== 'GLOBAL_ADMIN' && contact.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, data: contact });
}

export async function PATCH(req: NextRequest) {
  // Only owner can update
  const authCheck = authGuards.ownerOrAdmin(req);
  if (authCheck instanceof NextResponse) return authCheck;

  const { userRole, orgId } = getAuthHeaders(req);
  const id = new URL(req.url).pathname.split('/').pop();
  const body = await req.json();

  const contact = await prisma.contact.findUnique({
    where: { id: id! },
  });

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify org access
  if (userRole !== 'GLOBAL_ADMIN' && contact.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.contact.update({
    where: { id: id! },
    data: body,
  });

  return NextResponse.json({ ok: true, data: updated });
}

export async function DELETE(req: NextRequest) {
  // Only admin can hard delete
  const authCheck = authGuards.adminOnly(req);
  if (authCheck instanceof NextResponse) return authCheck;

  const id = new URL(req.url).pathname.split('/').pop();

  await prisma.contact.delete({ where: { id: id! } });

  return NextResponse.json({ ok: true });
}
```

---

## Migration Checklist

For each endpoint:

- [ ] Identify required role(s): admin, owner, agent, or public
- [ ] Choose guard: `validateAdminRole`, `validateAgentRole`, or `createAuthGuard`
- [ ] Add guard as first thing in handler
- [ ] Replace `getAuthContext()` calls with `getAuthHeaders()`
- [ ] Update `buildContactWhere()` to manual where-clause with role checks
- [ ] Add org filtering: `organizationId: orgId` for non-admin
- [ ] Add agent filtering: `assignedUserId: sessionId` for AGENT role
- [ ] Test all role combinations: GLOBAL_ADMIN, OWNER, AGENT, FREE_SALES
- [ ] Verify error responses are consistent
- [ ] Check logs for security violations

---

## Performance Gains

### Before
```
getAuthContext()
  ├─ Database lookup: SELECT from mabizSession
  ├─ Database lookup: SELECT from organizationMember
  └─ Database lookup: SELECT from User + AffiliateProfile (for mallUser)
= ~3 DB calls per request
```

### After
```
validateAdminRole(req)
  └─ Header check: x-is-admin === 'true'
= ~0 DB calls per request
```

**Result:** Faster auth, reduced database load, simpler error handling
