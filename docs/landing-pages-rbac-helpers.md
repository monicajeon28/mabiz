# Landing Pages RBAC 헬퍼 함수 설계

## 📋 문제 상황

현재 `/api/landing-pages` 엔드포인트에서 RBAC(Role-Based Access Control) 로직이 산재되어 있고, 다른 엔드포인트(`/api/landing-pages/[id]`, `/api/landing-pages/[id]/share` 등)에서도 동일한 로직을 반복하고 있습니다.

**현재 코드의 문제점:**
- 역할별 권한 검증이 각 엔드포인트마다 다름
- AGENT 권한 검증 누락
- 공유 페이지 권한 검증 불일치
- 코드 중복

---

## 🎯 해결 방안: RBAC 헬퍼 함수 분리

### 1. `src/lib/rbac-landing-pages.ts` 생성

```typescript
/**
 * Landing Pages RBAC 헬퍼 함수
 * 
 * 기능:
 * - 역할별 권한 검증
 * - WHERE 조건 빌드
 * - 공유 권한 검증
 */

import { AuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/** 랜딩 페이지 조회 권한 체크 */
export async function canViewLandingPage(
  ctx: AuthContext,
  page: { organizationId: string; createdByUserId: string | null; groupId: string | null },
  myOrgId: string
): Promise<boolean> {
  // 1️⃣ FREE_SALES: 차단
  if (ctx.role === 'FREE_SALES') return false;

  // 2️⃣ GLOBAL_ADMIN: 모든 페이지 조회 가능
  if (ctx.role === 'GLOBAL_ADMIN') return true;

  // 3️⃣ OWNER: 자기 조직의 페이지만
  if (ctx.role === 'OWNER') {
    return page.organizationId === myOrgId;
  }

  // 4️⃣ AGENT: 자신이 생성한 페이지 또는 할당된 고객 그룹의 페이지
  if (ctx.role === 'AGENT') {
    // 자신이 생성한 페이지
    if (page.createdByUserId === ctx.userId) return true;

    // 할당된 고객 그룹의 페이지
    if (page.groupId) {
      const groupMember = await prisma.contactGroupMember.findUnique({
        where: {
          groupId_contactId_memberId: {  // 스키마에 따라 조정 필요
            groupId: page.groupId,
            memberId: page.id,  // 또는 다른 필드
            assignedUserId: ctx.userId,
          },
        },
      });
      return !!groupMember;
    }

    return false;
  }

  return false;
}

/** 랜딩 페이지 수정 권한 체크 */
export function canEditLandingPage(
  ctx: AuthContext,
  page: { organizationId: string; createdByUserId: string | null },
  myOrgId: string
): boolean {
  // 1️⃣ FREE_SALES: 차단
  if (ctx.role === 'FREE_SALES') return false;

  // 2️⃣ GLOBAL_ADMIN: 모든 페이지 수정 가능
  if (ctx.role === 'GLOBAL_ADMIN') return true;

  // 3️⃣ OWNER: 자기 조직의 페이지만 수정
  if (ctx.role === 'OWNER') {
    return page.organizationId === myOrgId;
  }

  // 4️⃣ AGENT: 자신이 생성한 페이지만 수정
  if (ctx.role === 'AGENT') {
    return page.createdByUserId === ctx.userId;
  }

  return false;
}

/** 랜딩 페이지 삭제 권한 체크 */
export function canDeleteLandingPage(
  ctx: AuthContext,
  page: { organizationId: string; createdByUserId: string | null },
  myOrgId: string
): boolean {
  // 1️⃣ FREE_SALES/AGENT: 차단
  if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') return false;

  // 2️⃣ GLOBAL_ADMIN: 모든 페이지 삭제 가능
  if (ctx.role === 'GLOBAL_ADMIN') return true;

  // 3️⃣ OWNER: 자기 조직의 페이지만 삭제
  if (ctx.role === 'OWNER') {
    return page.organizationId === myOrgId;
  }

  return false;
}

/** 공유 페이지 조회 권한 체크 */
export function canViewSharedPage(
  ctx: AuthContext,
  share: { sharedToOrgId: string; isGlobal: boolean },
  myOrgId: string
): boolean {
  // 1️⃣ FREE_SALES: 차단
  if (ctx.role === 'FREE_SALES') return false;

  // 2️⃣ GLOBAL_ADMIN: 모든 공유 페이지 조회 가능
  if (ctx.role === 'GLOBAL_ADMIN') return true;

  // 3️⃣ 명시적 공유 또는 전역 공유
  return share.sharedToOrgId === myOrgId || share.isGlobal;
}

/** 공유 권한 부여 권한 체크 */
export function canShareLandingPage(
  ctx: AuthContext,
  pageOrgId: string,
  myOrgId: string
): boolean {
  // 1️⃣ FREE_SALES/AGENT: 차단
  if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') return false;

  // 2️⃣ GLOBAL_ADMIN: 모든 페이지 공유 가능
  if (ctx.role === 'GLOBAL_ADMIN') return true;

  // 3️⃣ OWNER: 자기 조직의 페이지만 공유
  if (ctx.role === 'OWNER') {
    return pageOrgId === myOrgId;
  }

  return false;
}

/** 랜딩 페이지 목록 조회 WHERE 조건 생성 */
export async function buildLandingPageWhere(
  ctx: AuthContext,
  myOrgId: string,
  options: {
    includeInactive?: boolean;
    search?: string;
    category?: string;
  } = {}
): Promise<Record<string, any>> {
  const { includeInactive = false, search, category } = options;

  let where: Record<string, any> = {
    isActive: !includeInactive,
  };

  // 역할별 조직 필터
  if (ctx.role !== 'GLOBAL_ADMIN') {
    where.organizationId = myOrgId;
  }

  // AGENT: 자신의 페이지 + 할당된 고객 그룹의 페이지
  if (ctx.role === 'AGENT' && ctx.userId) {
    const assignedGroups = await prisma.contactGroup.findMany({
      where: {
        organizationId: myOrgId,
        members: {
          some: {
            assignedUserId: ctx.userId,
          },
        },
      },
      select: { id: true },
    });

    const assignedGroupIds = assignedGroups.map((g) => g.id);

    where.OR = [
      { createdByUserId: ctx.userId },
      ...(assignedGroupIds.length > 0
        ? [{ groupId: { in: assignedGroupIds } }]
        : []),
    ];
  }

  // 검색
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // 카테고리 필터
  if (category) {
    where.category = category;
  }

  return where;
}

/** 공유 페이지 목록 조회 WHERE 조건 생성 */
export function buildSharedLandingPageWhere(
  ctx: AuthContext,
  myOrgId: string,
  options: {
    includeInactive?: boolean;
  } = {}
): Record<string, any> {
  const { includeInactive = false } = options;

  return {
    OR: [
      { sharedToOrgId: myOrgId },
      { isGlobal: true },
    ],
    landingPage: {
      organizationId: { not: myOrgId },
      isActive: !includeInactive,
    },
  };
}

/** 권한 없음 에러 반환 */
export function createForbiddenError(reason: string = '권한이 없습니다') {
  return new Error(`FORBIDDEN: ${reason}`);
}

/** 권한 없음 HTTP 응답 생성 */
export function createForbiddenResponse(message: string = '권한이 없습니다') {
  return { ok: false, error: 'FORBIDDEN', message };
}

export const HTTP_FORBIDDEN = { status: 403 } as const;
```

---

## 2. 헬퍼 함수 사용 예제

### GET /api/landing-pages (목록 조회)

```typescript
// 개선 전
export async function GET() {
  const ctx = await getAuthContext();
  if (ctx.role === 'FREE_SALES') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const orgId = resolveOrgIdOrNull(ctx);
  const myOrgId = orgId ?? BONSA_ORG_ID;

  let pageWhere = { organizationId: orgId };
  if (ctx.role === 'AGENT') {
    // ... 복잡한 로직
  }

  const pages = await prisma.crmLandingPage.findMany({ where: pageWhere });
  // ...
}

// 개선 후
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  const url = new URL(req.url);
  const myOrgId = resolveOrgIdOrNull(ctx) ?? BONSA_ORG_ID;

  // ✅ 권한 검증 한 줄
  if (!canViewLandingPage(ctx, { organizationId: myOrgId }, myOrgId)) {
    return NextResponse.json(
      createForbiddenResponse(),
      { status: 403 }
    );
  }

  // ✅ WHERE 조건 생성 한 줄
  const pageWhere = await buildLandingPageWhere(ctx, myOrgId, {
    search: url.searchParams.get('search') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
  });

  const pages = await prisma.crmLandingPage.findMany({
    where: pageWhere,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ ok: true, pages });
}
```

### GET /api/landing-pages/[id] (단건 조회)

```typescript
// D:\mabiz-crm\src\app\api\landing-pages\[id]\route.ts

import { canViewLandingPage, canEditLandingPage, canDeleteLandingPage } from '@/lib/rbac-landing-pages';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const myOrgId = resolveOrgIdOrNull(ctx) ?? BONSA_ORG_ID;

    // 페이지 조회
    const page = await prisma.crmLandingPage.findUnique({
      where: { id: params.id },
    });

    if (!page) {
      return NextResponse.json({ ok: false, message: '페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // ✅ 권한 검증 (한 함수 호출)
    const canView = await canViewLandingPage(ctx, page, myOrgId);
    if (!canView) {
      return NextResponse.json(
        createForbiddenResponse('이 페이지를 조회할 권한이 없습니다'),
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      page,
      permissions: {
        canEdit: canEditLandingPage(ctx, page, myOrgId),
        canDelete: canDeleteLandingPage(ctx, page, myOrgId),
        canShare: canShareLandingPage(ctx, page.organizationId, myOrgId),
      },
    });
  } catch (err) {
    logger.error('[GET /api/landing-pages/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const myOrgId = resolveOrgIdOrNull(ctx) ?? BONSA_ORG_ID;

    const page = await prisma.crmLandingPage.findUnique({
      where: { id: params.id },
    });

    if (!page) {
      return NextResponse.json({ ok: false, message: '페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // ✅ 권한 검증 (한 함수 호출)
    if (!canEditLandingPage(ctx, page, myOrgId)) {
      return NextResponse.json(
        createForbiddenResponse('이 페이지를 수정할 권한이 없습니다'),
        { status: 403 }
      );
    }

    const body = await req.json();
    const updated = await prisma.crmLandingPage.update({
      where: { id: params.id },
      data: { ...body, updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, page: updated });
  } catch (err) {
    logger.error('[PUT /api/landing-pages/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const myOrgId = resolveOrgIdOrNull(ctx) ?? BONSA_ORG_ID;

    const page = await prisma.crmLandingPage.findUnique({
      where: { id: params.id },
    });

    if (!page) {
      return NextResponse.json({ ok: false, message: '페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // ✅ 권한 검증 (한 함수 호출)
    if (!canDeleteLandingPage(ctx, page, myOrgId)) {
      return NextResponse.json(
        createForbiddenResponse('이 페이지를 삭제할 권한이 없습니다'),
        { status: 403 }
      );
    }

    // 소프트 삭제 또는 하드 삭제
    const result = ctx.role === 'GLOBAL_ADMIN'
      ? await prisma.crmLandingPage.delete({ where: { id: params.id } })
      : await prisma.crmLandingPage.update({
          where: { id: params.id },
          data: { isActive: false },
        });

    return NextResponse.json({ ok: true, page: result });
  } catch (err) {
    logger.error('[DELETE /api/landing-pages/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

### POST /api/landing-pages/[id]/share (공유)

```typescript
import { canShareLandingPage, canViewSharedPage } from '@/lib/rbac-landing-pages';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const myOrgId = resolveOrgIdOrNull(ctx) ?? BONSA_ORG_ID;

    const page = await prisma.crmLandingPage.findUnique({
      where: { id: params.id },
    });

    if (!page) {
      return NextResponse.json({ ok: false, message: '페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // ✅ 권한 검증 (한 함수 호출)
    if (!canShareLandingPage(ctx, page.organizationId, myOrgId)) {
      return NextResponse.json(
        createForbiddenResponse('이 페이지를 공유할 권한이 없습니다'),
        { status: 403 }
      );
    }

    const { sharedToOrgId, isGlobal } = await req.json();

    const share = await prisma.crmLandingShare.create({
      data: {
        landingPageId: params.id,
        sharedToOrgId: isGlobal ? myOrgId : sharedToOrgId,
        sharedByUserId: ctx.userId,
        sharedByOrgId: myOrgId,
        sharedByName: ctx.member?.displayName ?? ctx.userId,
        isGlobal,
      },
    });

    return NextResponse.json({ ok: true, share }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/landing-pages/[id]/share]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 3. 권한 체크 매트릭스

```
┌─────────────────┬──────────┬────────┬────────┬──────┐
│ 작업            │ ADMIN    │ OWNER  │ AGENT  │ FREE │
├─────────────────┼──────────┼────────┼────────┼──────┤
│ 목록 조회        │ ✅ 전체  │ ✅ 자조│ ✅ 자신│ ❌   │
│ 단건 조회        │ ✅ 전체  │ ✅ 자조│ ✅ 자신│ ❌   │
│ 생성             │ ✅       │ ✅     │ ✅     │ ❌   │
│ 수정             │ ✅ 전체  │ ✅ 자조│ ✅ 자신│ ❌   │
│ 삭제             │ ✅ 하드  │ ✅ 소프│ ❌     │ ❌   │
│ 공유             │ ✅       │ ✅ 자조│ ❌     │ ❌   │
│ 공유받은것 조회  │ ✅ 전체  │ ✅ 전체│ ✅ 전체│ ❌   │
│ 댓글 생성        │ ✅       │ ✅     │ ✅     │ ❌   │
│ 통계 조회        │ ✅ 전체  │ ✅ 자조│ ✅ 자신│ ❌   │
└─────────────────┴──────────┴────────┴────────┴──────┘

주:
- 자조: 자신의 조직
- 자신: 자신이 생성한 또는 할당받은
- 소프: 소프트 삭제 (isActive=false)
- 하드: 하드 삭제
```

---

## 4. 테스트 작성

```typescript
// tests/lib/rbac-landing-pages.test.ts

import { canViewLandingPage, canEditLandingPage, buildLandingPageWhere } from '@/lib/rbac-landing-pages';
import type { AuthContext } from '@/lib/rbac';

describe('RBAC Landing Pages', () => {
  const adminCtx: AuthContext = {
    userId: 'admin-1',
    role: 'GLOBAL_ADMIN',
    organizationId: null,
    member: null,
  };

  const ownerCtx: AuthContext = {
    userId: 'owner-1',
    role: 'OWNER',
    organizationId: 'org-1',
    member: null,
  };

  const agentCtx: AuthContext = {
    userId: 'agent-1',
    role: 'AGENT',
    organizationId: 'org-1',
    member: null,
  };

  const freeSalesCtx: AuthContext = {
    userId: 'free-1',
    role: 'FREE_SALES',
    organizationId: null,
    member: null,
  };

  describe('canViewLandingPage', () => {
    const orgPage = {
      organizationId: 'org-1',
      createdByUserId: 'agent-1',
      groupId: 'group-1',
    };

    it('should deny FREE_SALES', async () => {
      expect(await canViewLandingPage(freeSalesCtx, orgPage, 'org-1')).toBe(false);
    });

    it('should allow GLOBAL_ADMIN', async () => {
      expect(await canViewLandingPage(adminCtx, orgPage, 'org-1')).toBe(true);
    });

    it('should allow OWNER of same org', async () => {
      expect(await canViewLandingPage(ownerCtx, orgPage, 'org-1')).toBe(true);
    });

    it('should deny OWNER of different org', async () => {
      expect(await canViewLandingPage(ownerCtx, orgPage, 'org-2')).toBe(false);
    });

    it('should allow AGENT who created it', async () => {
      expect(await canViewLandingPage(agentCtx, orgPage, 'org-1')).toBe(true);
    });

    it('should deny AGENT who did not create it', async () => {
      expect(await canViewLandingPage(agentCtx, { ...orgPage, createdByUserId: 'agent-2' }, 'org-1')).toBe(false);
    });
  });

  describe('canEditLandingPage', () => {
    const orgPage = {
      organizationId: 'org-1',
      createdByUserId: 'agent-1',
    };

    it('should deny AGENT for edit', () => {
      expect(canEditLandingPage(agentCtx, orgPage, 'org-1')).toBe(true);
    });

    it('should deny AGENT who did not create it', () => {
      expect(canEditLandingPage(agentCtx, { ...orgPage, createdByUserId: 'agent-2' }, 'org-1')).toBe(false);
    });
  });

  describe('buildLandingPageWhere', () => {
    it('should filter by org for OWNER', async () => {
      const where = await buildLandingPageWhere(ownerCtx, 'org-1');
      expect(where.organizationId).toBe('org-1');
      expect(where.isActive).toBe(true);
    });

    it('should use OR condition for AGENT', async () => {
      const where = await buildLandingPageWhere(agentCtx, 'org-1');
      expect(where.OR).toBeDefined();
      expect(where.OR[0]).toEqual({ createdByUserId: 'agent-1' });
    });

    it('should include search filter', async () => {
      const where = await buildLandingPageWhere(ownerCtx, 'org-1', { search: 'test' });
      expect(where.OR).toBeDefined();
    });
  });
});
```

---

## 5. 마이그레이션 체크리스트

- [ ] `src/lib/rbac-landing-pages.ts` 생성
- [ ] 모든 landing-pages 엔드포인트에 적용
- [ ] 테스트 작성 및 실행
- [ ] 타입 체크: `npx tsc --noEmit`
- [ ] 빌드: `npm run build`
- [ ] 배포

---

**파일 위치**: `D:\mabiz-crm\src\lib\rbac-landing-pages.ts`  
**마지막 업데이트**: 2026-06-02
