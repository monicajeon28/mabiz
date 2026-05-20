# API Auth Quick Reference Card

## TL;DR — Use These 3 Things

### 1. Admin-Only Endpoint
```typescript
import { validateAdminRole } from '@/app/api/_auth/validate-admin-role';

export async function GET(req: NextRequest) {
  const check = validateAdminRole(req);
  if (check instanceof NextResponse) return check;
  // ... logic
}
```

### 2. Team-Member Endpoint
```typescript
import { authGuards } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const check = authGuards.teamMember(req);
  if (check instanceof NextResponse) return check;
  // ... logic
}
```

### 3. Owner-Only Endpoint
```typescript
import { authGuards } from '@/lib/auth-middleware';

export async function PATCH(req: NextRequest) {
  const check = authGuards.ownerOrAdmin(req);
  if (check instanceof NextResponse) return check;
  // ... logic
}
```

---

## Guard Cheat Sheet

| Use Case | Guard | Allows | Blocks |
|----------|-------|--------|--------|
| `/api/admin/*` | `validateAdminRole()` | GLOBAL_ADMIN | OWNER, AGENT, FREE_SALES |
| `/api/dashboard/*` | `authGuards.teamMember` | GLOBAL_ADMIN, OWNER, AGENT | FREE_SALES |
| `/api/organizations/*/settings` | `authGuards.ownerOrAdmin` | GLOBAL_ADMIN, OWNER | AGENT, FREE_SALES |
| `/api/contacts` (read) | `authGuards.teamMember` | GLOBAL_ADMIN, OWNER, AGENT | FREE_SALES |
| Custom role combo | `createAuthGuard(['OWNER'])` | Custom | Custom |

---

## Headers Available in Every Request

```typescript
import { getAuthHeaders } from '@/lib/auth-middleware';

const { sessionId, userRole, orgId, isAdmin } = getAuthHeaders(req);

// userRole is always one of: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES'
// orgId is null for GLOBAL_ADMIN
// isAdmin is true only if userRole === 'GLOBAL_ADMIN'
```

---

## Data Filtering Patterns

### Filter by Org (for OWNER/AGENT)
```typescript
const { userRole, orgId } = getAuthHeaders(req);

const where = userRole === 'GLOBAL_ADMIN'
  ? {}
  : { organizationId: orgId };
```

### Filter by Assigned User (for AGENT)
```typescript
const { userRole, sessionId } = getAuthHeaders(req);

const where = userRole === 'AGENT'
  ? { assignedUserId: sessionId }
  : {};
```

### Combined: Full Example
```typescript
const { userRole, orgId, sessionId } = getAuthHeaders(req);

const where = userRole === 'GLOBAL_ADMIN'
  ? { deletedAt: null }
  : userRole === 'OWNER'
  ? { organizationId: orgId, deletedAt: null }
  : { organizationId: orgId, assignedUserId: sessionId, deletedAt: null };
```

---

## Error Responses

All guards return `{ ok: false, error, code }`:

```typescript
// Admin-required endpoint, OWNER tried to access
{
  "ok": false,
  "error": "관리자 권한이 필요합니다.",
  "code": "ADMIN_REQUIRED"
}

// Agent-required endpoint, FREE_SALES tried to access
{
  "ok": false,
  "error": "조직 구성원 권한이 필요합니다.",
  "code": "AGENT_ROLE_REQUIRED"
}

// Role check failed
{
  "ok": false,
  "error": "접근 권한이 없습니다.",
  "code": "ROLE_REQUIRED",
  "required": ["OWNER", "GLOBAL_ADMIN"],
  "actual": "AGENT"
}
```

---

## Setup Checklist for New Endpoint

- [ ] Identify required role: admin / owner / agent / custom
- [ ] Choose guard: `validateAdminRole()` / `authGuards.X` / `createAuthGuard()`
- [ ] Add guard as first thing in handler
- [ ] Extract headers: `const { userRole, orgId } = getAuthHeaders(req)`
- [ ] Filter query by orgId: `organizationId: orgId`
- [ ] Test 4 roles: GLOBAL_ADMIN, OWNER, AGENT, FREE_SALES
- [ ] Verify org isolation: different org IDs blocked
- [ ] Check logs: security violations logged

---

## Debugging Failed Auth

Check these in order:

1. **Header missing?**
   ```typescript
   const headers = getAuthHeaders(req);
   console.log('Headers:', headers);
   ```

2. **Role wrong?**
   ```typescript
   // middleware.ts logs this
   [Middleware] Auth headers injected { role: 'OWNER' }
   ```

3. **Guard failing?**
   ```typescript
   // Logs appear here
   [Auth Guard] Role check failed { required: ['ADMIN'], actual: 'OWNER' }
   ```

4. **Data isolation issue?**
   ```typescript
   // Add temporary logging
   console.log('User orgId:', orgId);
   console.log('Query filter:', where);
   console.log('Results:', results);
   ```

---

## Performance Tips

✅ **Good:** Header checks (0 DB calls)
```typescript
const check = validateAdminRole(req); // Instant
```

❌ **Bad:** Database calls in auth
```typescript
const ctx = await getAuthContext(); // 3 DB calls
```

✅ **Good:** Filter queries by orgId
```typescript
where: { organizationId: orgId }
```

❌ **Bad:** Fetch all data, filter in code
```typescript
const all = await prisma.contact.findMany({});
const filtered = all.filter(c => c.orgId === orgId);
```

---

## Common Patterns

### Endpoint with Multiple Methods
```typescript
import { authGuards } from '@/lib/auth-middleware';

export async function GET(req) {
  const check = authGuards.teamMember(req);
  if (check instanceof NextResponse) return check;
  // Read logic
}

export async function PATCH(req) {
  const check = authGuards.ownerOrAdmin(req);
  if (check instanceof NextResponse) return check;
  // Update logic
}

export async function DELETE(req) {
  const check = authGuards.adminOnly(req);
  if (check instanceof NextResponse) return check;
  // Delete logic
}
```

### Org Isolation Check
```typescript
const { userRole, orgId } = getAuthHeaders(req);

// Fetch resource
const resource = await prisma.resource.findUnique({ where: { id } });

// Verify org access
if (userRole !== 'GLOBAL_ADMIN' && resource.organizationId !== orgId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Custom Role Combination
```typescript
import { createAuthGuard } from '@/lib/auth-middleware';

const requireOwnerOrAgent = createAuthGuard(
  ['OWNER', 'AGENT'],
  { requireOrgId: true, errorMessage: '판매팀만 접근 가능합니다.' }
);

export async function GET(req) {
  const check = requireOwnerOrAgent(req);
  if (check instanceof NextResponse) return check;
  // Logic
}
```

---

## Files Location

- **Quick checks:** `src/app/api/_auth/validate-*.ts`
- **Reusable guards:** `src/lib/auth-middleware.ts`
- **Guides:** `src/app/api/_auth/README.md`
- **Examples:** `src/app/api/_auth/EXAMPLE_IMPLEMENTATIONS.md`

---

## Next Steps

1. Use this for Wave 2 admin endpoint migration
2. Refer to EXAMPLE_IMPLEMENTATIONS.md for before/after code
3. Ask questions in INTEGRATION_GUIDE.md
4. Run npm build + npm run dev to verify

**That's it!** 🚀
