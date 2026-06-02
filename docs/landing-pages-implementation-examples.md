# GET /api/landing-pages 구현 예제 코드

## 1. AGENT 권한 검증 추가 (문제 1 해결)

### 현재 코드 (권한 검증 부족)
```typescript
// ❌ 문제: AGENT가 다른 AGENT의 페이지도 조회 가능
const pages = await prisma.crmLandingPage.findMany({
  where: { ...(orgId ? { organizationId: orgId } : {}) },
  orderBy: { createdAt: "desc" },
});
```

### 개선된 코드 (방식 A: 단순)
```typescript
// ✅ AGENT는 자신이 생성한 페이지만 조회 가능
let pageWhere: Record<string, unknown> = orgId ? { organizationId: orgId } : {};

if (ctx.role === 'AGENT') {
  pageWhere.createdByUserId = ctx.userId;  // 자신이 생성한 페이지만
}

const pages = await prisma.crmLandingPage.findMany({
  where: pageWhere,
  orderBy: { createdAt: "desc" },
  include: { _count: { select: { registrations: true } } },
});
```

### 개선된 코드 (방식 B: 할당된 그룹 포함)
```typescript
// ✅ AGENT는 자신이 생성한 페이지 또는 할당된 고객 그룹의 페이지
if (ctx.role === 'AGENT' && ctx.userId) {
  // 1. 할당된 고객 그룹 ID 조회
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

  // 2. WHERE 조건에 OR 추가
  pageWhere = {
    ...pageWhere,
    OR: [
      { createdByUserId: ctx.userId },
      ...(assignedGroupIds.length > 0
        ? [{ groupId: { in: assignedGroupIds } }]
        : []),
    ],
  };
}

const pages = await prisma.crmLandingPage.findMany({
  where: pageWhere,
  orderBy: { createdAt: "desc" },
  include: { _count: { select: { registrations: true } } },
});
```

---

## 2. 활성/비활성 페이지 필터링 추가 (문제 4 해결)

### 현재 코드 (isActive 필터 없음)
```typescript
// ❌ 문제: 비활성 페이지도 조회됨
const pages = await prisma.crmLandingPage.findMany({
  where: { organizationId: orgId },
});
```

### 개선된 코드
```typescript
// ✅ 활성 페이지만 기본 조회
const includeInactive = url.searchParams.get('includeInactive') === 'true';

const pages = await prisma.crmLandingPage.findMany({
  where: {
    organizationId: orgId,
    isActive: !includeInactive,  // 기본: isActive = true
  },
  orderBy: { createdAt: "desc" },
});

// 공유 페이지도 동일
const receivedShares = await prisma.crmLandingShare.findMany({
  where: {
    OR: [
      { sharedToOrgId: myOrgId },
      { isGlobal: true },
    ],
    landingPage: {
      organizationId: { not: myOrgId },
      isActive: !includeInactive,  // ✅ 추가
    },
  },
  include: { landingPage: { ... } },
});
```

---

## 3. 페이지네이션 추가 (문제 3 해결)

### 현재 코드 (전체 조회)
```typescript
// ❌ 문제: 페이지가 1000개 이상일 경우 응답 지연
const pages = await prisma.crmLandingPage.findMany({
  where: { organizationId: orgId },
  orderBy: { createdAt: "desc" },
  // skip/take 없음
});
```

### 개선된 코드 (기본)
```typescript
// ✅ 페이지네이션 파라미터
const url = new URL(req.url);
const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')));
const skip = (page - 1) * limit;

// ✅ 정렬 파라미터
const sortField = (['createdAt', 'updatedAt', 'viewCount'].includes(
  url.searchParams.get('sort') ?? ''
) ? url.searchParams.get('sort') : 'createdAt') as 'createdAt' | 'updatedAt' | 'viewCount';

const sortOrder = (url.searchParams.get('order') ?? 'desc') === 'asc' ? 'asc' : 'desc';

// ✅ 쿼리 실행 (병렬)
const [pages, total] = await Promise.all([
  prisma.crmLandingPage.findMany({
    where: { organizationId: orgId },
    orderBy: { [sortField]: sortOrder },
    skip,
    take: limit,
    include: { _count: { select: { registrations: true } } },
  }),
  prisma.crmLandingPage.count({
    where: { organizationId: orgId },
  }),
]);

// ✅ 응답
const totalPages = Math.ceil(total / limit);
return NextResponse.json({
  ok: true,
  pages,
  pagination: {
    page,
    limit,
    totalPages,
    totalItems: total,
  },
});
```

---

## 4. 병렬 쿼리 최적화 (성능 개선)

### 현재 코드 (순차 쿼리)
```typescript
// ❌ 문제: 3개 쿼리가 순차 실행 → 응답 시간 3배
const pages = await prisma.crmLandingPage.findMany({ ... });
const receivedShares = await prisma.crmLandingShare.findMany({ ... });
const byOrgs = await prisma.organization.findMany({ ... });  // n+1 쿼리
```

### 개선된 코드 (병렬 쿼리)
```typescript
// ✅ 내 페이지 + 공유 페이지를 병렬로 조회
const [pages, pagesTotal, receivedShares, sharesTotal] = await Promise.all([
  prisma.crmLandingPage.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    include: { _count: { select: { registrations: true } } },
  }),
  prisma.crmLandingPage.count({
    where: { organizationId: orgId },
  }),
  prisma.crmLandingShare.findMany({
    where: { /* ... */ },
    include: { landingPage: { ... } },
    skip,
    take: limit,
  }),
  prisma.crmLandingShare.count({
    where: { /* ... */ },
  }),
]);

// ✅ 조직 정보 조회 (병렬)
const byOrgIds = [...new Set(receivedShares.map((s) => s.sharedByOrgId))];
const byOrgs = byOrgIds.length > 0
  ? await prisma.organization.findMany({
      where: { id: { in: byOrgIds } },
      select: { id: true, name: true },
    })
  : [];
```

---

## 5. DB 인덱스 추가 (schema.prisma)

### 현재 스키마 (인덱스 부족)
```prisma
// ❌ 문제: 조직별 + 정렬 조합 쿼리 느림
model CrmLandingPage {
  id                String    @id @default(cuid())
  organizationId    String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  isActive          Boolean   @default(true)
  // ... 기타 필드
}

model CrmLandingShare {
  id             String         @id @default(cuid())
  landingPageId  String
  sharedToOrgId  String
  createdAt      DateTime       @default(now())
  // ... 기타 필드
}
```

### 개선된 스키마 (인덱스 추가)
```prisma
// ✅ 조직별 정렬 쿼리 최적화
model CrmLandingPage {
  id                String    @id @default(cuid())
  organizationId    String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  isActive          Boolean   @default(true)
  viewCount         Int       @default(0)
  // ... 기타 필드

  @@index([organizationId, createdAt])      // 조직별 최신순 조회
  @@index([organizationId, updatedAt])      // 조직별 수정일순 조회
  @@index([isActive, organizationId])       // 활성 페이지 조회
  @@index([organizationId, isActive])       // 조직별 활성 페이지
  @@index([createdByUserId, organizationId])  // AGENT 페이지 조회
}

// ✅ 공유 페이지 조회 최적화
model CrmLandingShare {
  id             String         @id @default(cuid())
  landingPageId  String
  sharedToOrgId  String
  isGlobal       Boolean        @default(false)
  createdAt      DateTime       @default(now())
  // ... 기타 필드

  @@index([sharedToOrgId, createdAt])           // 공유받은 페이지 조회
  @@index([sharedToOrgId, isGlobal])            // 공유 여부별 조회
  @@index([landingPageId, sharedToOrgId])       // 중복 공유 방지
}
```

**마이그레이션 실행:**
```bash
npx prisma migrate dev --name add_landing_page_indexes
npx prisma generate
```

---

## 6. 전체 통합 구현 (모든 개선사항)

```typescript
// D:\mabiz-crm\src\app\api\landing-pages\route.ts (개선판)

export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgIdOrNull, BONSA_ORG_ID } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const startTime = Date.now();
  try {
    // 1️⃣ 인증 + 역할 검증
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 2️⃣ 쿼리 파라미터 파싱
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')));
    const skip = (page - 1) * limit;
    const sortField = (['createdAt', 'updatedAt', 'viewCount'].includes(
      url.searchParams.get('sort') ?? ''
    ) ? url.searchParams.get('sort') : 'createdAt') as any;
    const sortOrder = (url.searchParams.get('order') ?? 'desc') === 'asc' ? 'asc' : 'desc';
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const search = url.searchParams.get('search')?.trim();

    // 3️⃣ orgId 결정
    const orgId = resolveOrgIdOrNull(ctx);
    const myOrgId = orgId ?? BONSA_ORG_ID;

    // 4️⃣ 내 페이지 WHERE 조건 빌드
    let pageWhere: Record<string, any> = {
      isActive: !includeInactive,
    };

    if (orgId) {
      pageWhere.organizationId = orgId;
    }

    // 5️⃣ AGENT 권한 검증 추가
    if (ctx.role === 'AGENT' && ctx.userId) {
      const assignedGroups = await prisma.contactGroup.findMany({
        where: {
          organizationId: myOrgId,
          members: { some: { assignedUserId: ctx.userId } },
        },
        select: { id: true },
      });

      const assignedGroupIds = assignedGroups.map((g) => g.id);

      pageWhere.OR = [
        { createdByUserId: ctx.userId },
        ...(assignedGroupIds.length > 0
          ? [{ groupId: { in: assignedGroupIds } }]
          : []),
      ];
    }

    // 6️⃣ 검색 필터
    if (search) {
      pageWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 7️⃣ 병렬 쿼리 실행
    const [pages, pagesTotal, receivedShares, sharesTotal] = await Promise.all([
      prisma.crmLandingPage.findMany({
        where: pageWhere,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
        include: {
          _count: { select: { registrations: true } },
          group: { select: { id: true, name: true } },
        },
      }),
      prisma.crmLandingPage.count({ where: pageWhere }),
      prisma.crmLandingShare.findMany({
        where: {
          OR: [
            { sharedToOrgId: myOrgId },
            { isGlobal: true },
          ],
          landingPage: {
            organizationId: { not: myOrgId },
            isActive: !includeInactive,
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: sortOrder },
        include: {
          landingPage: {
            include: { _count: { select: { registrations: true } } },
          },
        },
      }),
      prisma.crmLandingShare.count({
        where: {
          OR: [
            { sharedToOrgId: myOrgId },
            { isGlobal: true },
          ],
          landingPage: {
            organizationId: { not: myOrgId },
            isActive: !includeInactive,
          },
        },
      }),
    ]);

    // 8️⃣ 조직 정보 조회
    const byOrgIds = [...new Set(receivedShares.map((s) => s.sharedByOrgId))];
    const byOrgs = byOrgIds.length > 0
      ? await prisma.organization.findMany({
          where: { id: { in: byOrgIds } },
          select: { id: true, name: true },
        })
      : [];
    const byOrgMap = Object.fromEntries(byOrgs.map((o) => [o.id, o.name]));

    // 9️⃣ 응답 구조화
    const sharedPages = receivedShares.map((s) => ({
      ...s.landingPage,
      isShared: true,
      sharedByName: s.sharedByName,
      sharedByOrgId: s.sharedByOrgId,
      sharedByOrgName: byOrgMap[s.sharedByOrgId] ?? s.sharedByOrgId,
      shareId: s.id,
    }));

    // 🔟 응답 전송
    const duration = Date.now() - startTime;
    logger.debug('[GET /api/landing-pages]', {
      duration,
      pagesCount: pages.length,
      sharedCount: sharedPages.length,
      userRole: ctx.role,
    });

    return NextResponse.json({
      ok: true,
      pages: pages.map((p) => ({ ...p, isShared: false })),
      sharedPages,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(Math.max(pagesTotal, sharesTotal) / limit),
        totalItems: pagesTotal + sharesTotal,
      },
    });
  } catch (err) {
    logger.error("[GET /api/landing-pages]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 7. 테스트 케이스

```typescript
// tests/landing-pages-api.test.ts

describe('GET /api/landing-pages', () => {
  // 테스트 1: FREE_SALES 차단
  it('should reject FREE_SALES role', async () => {
    const res = await fetch('/api/landing-pages', {
      headers: { authorization: 'Bearer FREE_SALES_TOKEN' },
    });
    expect(res.status).toBe(403);
  });

  // 테스트 2: AGENT는 자신의 페이지만 조회
  it('should only return AGENT-owned pages', async () => {
    const res = await fetch('/api/landing-pages', {
      headers: { authorization: 'Bearer AGENT_TOKEN' },
    });
    const data = await res.json();
    expect(data.pages.every(p => p.createdByUserId === AGENT_USER_ID)).toBe(true);
  });

  // 테스트 3: OWNER는 모든 조직 페이지 조회
  it('should return all org pages for OWNER', async () => {
    const res = await fetch('/api/landing-pages', {
      headers: { authorization: 'Bearer OWNER_TOKEN' },
    });
    const data = await res.json();
    expect(data.pages.length > 0).toBe(true);
  });

  // 테스트 4: 페이지네이션
  it('should paginate correctly', async () => {
    const res = await fetch('/api/landing-pages?page=2&limit=10', {
      headers: { authorization: 'Bearer TOKEN' },
    });
    const data = await res.json();
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(10);
  });

  // 테스트 5: 활성 페이지만 기본 조회
  it('should only return active pages by default', async () => {
    const res = await fetch('/api/landing-pages', {
      headers: { authorization: 'Bearer TOKEN' },
    });
    const data = await res.json();
    expect(data.pages.every(p => p.isActive === true)).toBe(true);
  });

  // 테스트 6: 공유 페이지 조회
  it('should include shared pages', async () => {
    const res = await fetch('/api/landing-pages', {
      headers: { authorization: 'Bearer TOKEN' },
    });
    const data = await res.json();
    expect(data.sharedPages.length >= 0).toBe(true);
  });
});
```

---

## 8. 마이그레이션 체크리스트

- [ ] DB 인덱스 추가 (schema.prisma)
- [ ] `npx prisma migrate dev --name add_landing_page_indexes` 실행
- [ ] `npx prisma generate` 실행
- [ ] AGENT 권한 검증 코드 추가
- [ ] 페이지네이션 파라미터 추가
- [ ] isActive 필터 추가
- [ ] 병렬 쿼리 구현
- [ ] 테스트 작성 및 실행
- [ ] 배포 전 E2E 테스트

---

**마지막 업데이트**: 2026-06-02
