# 메뉴 #23 (B2B 에디터) — 상세 작업지시서

**작성 일시**: 2026-05-16  
**버전**: Step 4 작업지시서  
**예상 소요 시간**: 5시간 (Phase 1: 2.5h + Phase 2: 1.5h + Phase 3: 1h)  
**우선순위**: P0 4개 + P1 2개 함께 수정  

---

## 📋 목차

1. [Phase 1: DB 스키마 + API 구축 (2.5h)](#phase-1)
2. [Phase 2: 보안 수정 (1.5h)](#phase-2)
3. [Phase 3: 테스트 (1h)](#phase-3)
4. [배포 체크리스트](#배포-체크리스트)

---

## Phase 1: DB 스키마 + API 구축 (2.5h) {#phase-1}

### 1️⃣ B2BProspect 모델 추가 → Prisma 스키마

**파일**: `prisma/schema.prisma`

B2BProspect 모델 추가 위치: `Trip` 모델 아래 (대략 라인 450~500 근처)

```prisma
model B2BProspect {
  id                String    @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  
  // 기본 정보
  name              String
  phone             String
  email             String
  companyName       String?
  position          String?
  
  // B2B 관심 정보
  packageInterest   String?   // e.g., "해외 크루즈", "국내 크루즈"
  educationType     String?   // e.g., "직원교육", "고객교육"
  estimatedBudget   Int?      // 예상 예산 (원)
  
  // 결제 정보
  paymentAmount     Decimal   @default(0)
  paymentDate       DateTime?
  paymentStatus     String    @default("PENDING") // PENDING | COMPLETED | FAILED
  
  // 상태 관리
  status            String    @default("NEW")     // NEW | CONTACTED | QUALIFIED | CLOSED
  source            String?   // e.g., "website", "email", "phone"
  affiliateCode     String?   // 제휴 코드
  
  // CRM 연동
  contactId         String?   // crm_contacts 테이블 ID
  assignedUserId    String?   // 담당자 ID
  
  // 메타
  notes             String?
  metadata          Json?     // 추가 커스텀 정보
  
  // 타임스탬프
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // 관계
  registrations     B2BLandingRegistration[]
  comments          B2BProspectComment[]
  
  @@index([organizationId])
  @@index([email, phone])
  @@index([status])
  @@index([createdAt])
  @@unique([organizationId, email, phone])
}

model B2BLandingPage {
  id                String    @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  
  // 템플릿
  templateType      String    @default("GLOBAL")  // GLOBAL | PARTNER
  partnerSlug       String?   // 파트너 slug (PARTNER만 유효)
  name              String    // 페이지 이름
  
  // 내용
  title             String
  description       String?
  htmlContent       String    // 직접 편집 HTML
  cssContent        String?   // 커스텀 CSS
  
  // 상태
  isPublished       Boolean   @default(false)
  publishedAt       DateTime?
  
  // 메타
  metadata          Json?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  registrations     B2BLandingRegistration[]
  
  @@index([organizationId])
  @@index([templateType, partnerSlug])
  @@unique([organizationId, partnerSlug])
}

model B2BLandingRegistration {
  id                String    @id @default(cuid())
  landingPageId     String
  landingPage       B2BLandingPage @relation(fields: [landingPageId], references: [id])
  
  prospectId        String
  prospect          B2BProspect @relation(fields: [prospectId], references: [id])
  
  // 신청 폼 데이터
  formData          Json      // 폼 응답 저장
  
  // 상태
  status            String    @default("NEW")     // NEW | PENDING | CONVERTED
  convertedAt       DateTime?
  
  // 메타
  ipAddress         String?
  userAgent         String?
  source            String?   // UTM source
  utm               Json?     // 전체 UTM 파라미터
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  comments          B2BProspectComment[]
  
  @@index([landingPageId])
  @@index([prospectId])
  @@index([createdAt])
  @@unique([landingPageId, prospectId])
}

model B2BProspectComment {
  id                String    @id @default(cuid())
  prospectId        String
  prospect          B2BProspect @relation(fields: [prospectId], references: [id])
  
  registrationId    String?
  registration      B2BLandingRegistration? @relation(fields: [registrationId], references: [id])
  
  createdById       String
  createdBy         User @relation(fields: [createdById], references: [id])
  
  content           String
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([prospectId])
  @@index([createdById])
}
```

**마이그레이션 실행**:
```bash
npx prisma migrate dev --name add_b2b_models
```

---

### 2️⃣ /api/b2b 엔드포인트 생성

**파일**: `src/app/api/b2b/route.ts` (새로 생성)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/b2b
 * B2B 고객 목록 조회
 * - GLOBAL_ADMIN: 전체 조직
 * - OWNER: 자기 조직만
 * - AGENT: 자신이 assigned인 고객만
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (!['GLOBAL_ADMIN', 'OWNER', 'AGENT'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');

    const where: Record<string, unknown> = {};

    // 권한별 필터링
    if (ctx.role === 'OWNER') {
      where.organizationId = ctx.organizationId;
    } else if (ctx.role === 'AGENT') {
      where.assignedUserId = ctx.userId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      where.OR = [
        { name: { contains: escapedSearch, mode: 'insensitive' } },
        { email: { contains: escapedSearch, mode: 'insensitive' } },
        { companyName: { contains: escapedSearch, mode: 'insensitive' } },
      ];
    }

    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.b2BProspect.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      prospects,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[b2b] GET error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/b2b
 * B2B 고객 생성
 * - GLOBAL_ADMIN: 모든 조직
 * - OWNER: 자기 조직만
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (!['GLOBAL_ADMIN', 'OWNER'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    let { organizationId, name, email, phone, companyName, packageInterest, educationType, paymentAmount } = body;

    // OWNER는 자기 조직만
    if (ctx.role === 'OWNER' && organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '자기 조직만 등록 가능합니다' }, { status: 403 });
    }

    if (!organizationId || !name || !email || !phone) {
      return NextResponse.json(
        { ok: false, error: 'organizationId, name, email, phone 필수' },
        { status: 400 },
      );
    }

    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId,
        name,
        email,
        phone,
        companyName: companyName ?? null,
        packageInterest: packageInterest ?? null,
        educationType: educationType ?? null,
        paymentAmount: paymentAmount ?? 0,
        status: 'NEW',
      },
    });

    logger.info('[b2b] POST created', {
      organizationId,
      prospectId: prospect.id,
      email: prospect.email,
    });

    return NextResponse.json({ ok: true, prospect }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[b2b] POST error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

---

### 3️⃣ /api/b2b/[id] 엔드포인트 생성

**파일**: `src/app/api/b2b/[id]/route.ts` (새로 생성)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/b2b/[id]
 * B2B 고객 상세 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getAuthContext();
    const { id } = params;

    if (!['GLOBAL_ADMIN', 'OWNER', 'AGENT'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const prospect = await prisma.b2BProspect.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        registrations: { include: { landingPage: true } },
        comments: { include: { createdBy: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!prospect) {
      return NextResponse.json({ ok: false, error: '해당 고객을 찾을 수 없습니다' }, { status: 404 });
    }

    // 권한 검증
    if (ctx.role === 'OWNER' && prospect.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    if (ctx.role === 'AGENT' && prospect.assignedUserId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, prospect });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[b2b/[id]] GET error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/[id]
 * B2B 고객 수정
 * - GLOBAL_ADMIN: 모든 고객
 * - OWNER: 자기 조직 고객
 * - AGENT: 자신이 assigned인 고객만
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getAuthContext();
    const { id } = params;

    if (!['GLOBAL_ADMIN', 'OWNER', 'AGENT'].includes(ctx.role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: '해당 고객을 찾을 수 없습니다' }, { status: 404 });
    }

    // 권한 검증
    if (ctx.role === 'OWNER' && existing.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    if (ctx.role === 'AGENT' && existing.assignedUserId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      companyName,
      position,
      packageInterest,
      educationType,
      estimatedBudget,
      paymentAmount,
      paymentDate,
      paymentStatus,
      status,
      assignedUserId,
      notes,
    } = body;

    const updated = await prisma.b2BProspect.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(companyName !== undefined ? { companyName } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(packageInterest !== undefined ? { packageInterest } : {}),
        ...(educationType !== undefined ? { educationType } : {}),
        ...(estimatedBudget !== undefined ? { estimatedBudget } : {}),
        ...(paymentAmount !== undefined ? { paymentAmount } : {}),
        ...(paymentDate !== undefined ? { paymentDate } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(status ? { status } : {}),
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    logger.info('[b2b/[id]] PATCH updated', {
      prospectId: id,
      email: updated.email,
    });

    return NextResponse.json({ ok: true, prospect: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[b2b/[id]] PATCH error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/[id]
 * B2B 고객 소프트 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getAuthContext();
    const { id } = params;

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: '해당 고객을 찾을 수 없습니다' }, { status: 404 });
    }

    // 소프트 삭제: status를 DELETED로 변경
    const updated = await prisma.b2BProspect.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    logger.info('[b2b/[id]] DELETE soft-deleted', { prospectId: id });

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[b2b/[id]] DELETE error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

---

## Phase 2: 보안 수정 (1.5h) {#phase-2}

### 4️⃣ DEFAULT_ORGANIZATION_ID 제거

**파일**: `src/app/api/public/b2b/p/[partnerId]/route.ts`

**문제 위치**: 라인 15~25 (현재)

```typescript
// ❌ 수정 전 — 보안 취약점
async function resolveOrganization(slug: string) {
  return (
    (await prisma.organization.findUnique({ where: { slug } })) ??
    (await prisma.organization.findUnique({ where: { id: slug } })) ??
    (await prisma.organization.findUnique({ where: { id: DEFAULT_ORGANIZATION_ID } }))  // ← 위험
  );
}
```

**수정**:

```typescript
// ✅ 수정 후
async function resolveOrganization(slug: string) {
  const org =
    (await prisma.organization.findUnique({ where: { slug } })) ??
    (await prisma.organization.findUnique({ where: { id: slug } }));
  
  if (!org) {
    throw new Error('INVALID_PARTNER');
  }
  return org;
}

// 호출부에서 에러 처리
export async function GET(req: NextRequest, { params }: { params: { partnerId: string } }) {
  try {
    const org = await resolveOrganization(params.partnerId);
    // ... 이후 로직
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'INVALID_PARTNER') {
      return NextResponse.json({ ok: false, error: '파트너를 찾을 수 없습니다' }, { status: 404 });
    }
    // ...
  }
}
```

---

### 5️⃣ TOCTOU 방지: 트랜잭션으로 중복 체크 + 생성 원자화

**파일**: `src/app/api/public/b2b/p/[partnerId]/route.ts`

**문제 위치**: 리드 등록 로직 (현재 라인 50~80 추정)

```typescript
// ❌ 수정 전 — Race condition
const existing = await prisma.b2BProspect.findUnique({
  where: { organizationId_email_phone: { ... } }
});
if (existing) {
  // 48시간 체크...
}
// ← 이 사이에 다른 요청이 같은 데이터 생성 가능
const prospect = await prisma.b2BProspect.create({ ... });
```

**수정**:

```typescript
// ✅ 수정 후 — 원자적 처리
const result = await prisma.$transaction(async (tx) => {
  // 1. 기존 리드 조회
  const existing = await tx.b2BProspect.findUnique({
    where: { organizationId_email_phone: { organizationId: org.id, email, phone } }
  });
  
  if (existing) {
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - existing.createdAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCreation < 48) {
      throw new Error('DUPLICATE_WITHIN_48H');
    }
  }
  
  // 2. 신규 또는 재신청 리드 생성/업데이트
  const prospect = await tx.b2BProspect.upsert({
    where: { organizationId_email_phone: { organizationId: org.id, email, phone } },
    create: {
      organizationId: org.id,
      name,
      email,
      phone,
      companyName,
      packageInterest,
      educationType,
      status: 'NEW',
      source: 'LANDING_PAGE',
    },
    update: {
      name,
      companyName,
      packageInterest,
      educationType,
      status: 'NEW',
      updatedAt: new Date(),
    },
  });
  
  // 3. 랜딩 등록 기록
  const registration = await tx.b2BLandingRegistration.create({
    data: {
      landingPageId: landingPage.id,
      prospectId: prospect.id,
      formData,
      source: utmSource,
      utm: { source: utmSource, medium: utmMedium, campaign: utmCampaign, content: utmContent },
    },
  });
  
  return { prospect, registration };
});
```

---

## Phase 3: 테스트 (1h) {#phase-3}

### 6️⃣ 단위 + 통합 테스트

**파일**: `src/app/api/b2b/__tests__/b2b.test.ts` (새로 생성)

```typescript
import prisma from '@/lib/prisma';
import { POST, GET } from '../route';
import { getAuthContext } from '@/lib/rbac';

jest.mock('@/lib/rbac');
jest.mock('@/lib/prisma');

const mockAuthContext = {
  userId: 'user123',
  role: 'OWNER',
  organizationId: 'org123',
};

describe('/api/b2b', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(mockAuthContext);
  });

  describe('POST - 신규 B2B 고객 생성', () => {
    it('T1: OWNER가 자기 조직에 고객 추가 → 성공', async () => {
      const req = {
        json: async () => ({
          organizationId: 'org123',
          name: '홍길동',
          email: 'hong@company.com',
          phone: '01012345678',
          companyName: '크루즈여행사',
        }),
      } as any;

      (prisma.b2BProspect.create as jest.Mock).mockResolvedValue({
        id: 'prospect123',
        organizationId: 'org123',
        name: '홍길동',
        email: 'hong@company.com',
        phone: '01012345678',
        status: 'NEW',
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.prospect.email).toBe('hong@company.com');
    });

    it('T2: OWNER가 다른 조직에 고객 추가 시도 → 403 Forbidden', async () => {
      const req = {
        json: async () => ({
          organizationId: 'org456',
          name: '김철수',
          email: 'kim@company.com',
          phone: '01087654321',
        }),
      } as any;

      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('T3: 필수 필드 누락 → 400', async () => {
      const req = {
        json: async () => ({
          organizationId: 'org123',
          name: '박영희',
        }),
      } as any;

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET - B2B 고객 목록 조회', () => {
    it('T4: OWNER가 자기 조직 고객 목록 조회 → status=NEW 필터', async () => {
      const req = {
        url: 'http://localhost:3000/api/b2b?status=NEW',
      } as any;

      (prisma.b2BProspect.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'prospect123',
          organizationId: 'org123',
          name: '홍길동',
          status: 'NEW',
        },
      ]);
      (prisma.b2BProspect.count as jest.Mock).mockResolvedValue(1);

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.prospects.length).toBe(1);
      expect(data.prospects[0].status).toBe('NEW');
    });

    it('T5: AGENT가 assigned인 고객만 조회 → 다른 담당자 고객 제외', async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: 'agent456',
        role: 'AGENT',
        organizationId: 'org123',
      });

      const req = {
        url: 'http://localhost:3000/api/b2b',
      } as any;

      (prisma.b2BProspect.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.b2BProspect.count as jest.Mock).mockResolvedValue(0);

      const res = await GET(req);
      const data = await res.json();

      // AGENT는 assignedUserId 필터가 적용됨
      expect((prisma.b2BProspect.findMany as jest.Mock).mock.calls[0][0].where.assignedUserId).toBe('agent456');
    });
  });

  describe('TOCTOU 방지 - 트랜잭션', () => {
    it('T6: 동시에 같은 email+phone으로 신청 → 중복 방지', async () => {
      // 모의 트랜잭션 체인
      const mockTx = {
        b2BProspect: {
          findUnique: jest.fn().mockResolvedValueOnce(null),
          upsert: jest.fn().mockResolvedValue({
            id: 'prospect789',
            organizationId: 'org123',
            email: 'test@company.com',
          }),
        },
        b2BLandingRegistration: {
          create: jest.fn().mockResolvedValue({ id: 'reg123' }),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // 두 요청이 동시 실행되면 첫 번째만 CREATE, 두 번째는 UPDATE
      expect(mockTx.b2BProspect.upsert).toHaveBeenCalled();
    });

    it('T7: 48시간 내 재신청 → DUPLICATE_WITHIN_48H 에러', async () => {
      const nowMinus24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const mockTx = {
        b2BProspect: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'prospect123',
            createdAt: nowMinus24h,
          }),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        try {
          return await callback(mockTx);
        } catch (err) {
          if ((err as Error).message === 'DUPLICATE_WITHIN_48H') {
            throw err;
          }
        }
      });

      // 48시간 내 재신청 시도 → 에러 던짐
      expect(async () => {
        await (prisma.$transaction as jest.Mock)();
      }).rejects.toThrow('DUPLICATE_WITHIN_48H');
    });
  });
});
```

**테스트 실행**:
```bash
npm test -- b2b.test.ts
```

---

## 배포 체크리스트 {#배포-체크리스트}

- [ ] **Phase 1 완료**
  - [ ] `prisma/schema.prisma` — B2BProspect/LandingPage/Registration/Comment 모델 추가
  - [ ] `npx prisma migrate dev --name add_b2b_models` 실행 (마이그레이션 파일 생성)
  - [ ] `src/app/api/b2b/route.ts` — GET/POST 엔드포인트 생성
  - [ ] `src/app/api/b2b/[id]/route.ts` — GET/PATCH/DELETE 엔드포인트 생성
  - [ ] 타입 생성 확인: `npm run build` 에러 없음

- [ ] **Phase 2 완료**
  - [ ] `src/app/api/public/b2b/p/[partnerId]/route.ts` — DEFAULT_ORGANIZATION_ID 제거
  - [ ] `resolveOrganization()` 함수 404 에러 처리 추가
  - [ ] 리드 등록 로직 트랜잭션 래핑 완료
  - [ ] TOCTOU 레이스 컨디션 방지 확인

- [ ] **Phase 3 완료**
  - [ ] 테스트 파일 작성 및 모든 테스트 통과
  - [ ] 개발 서버 재시작: `npm run dev`
  - [ ] 수동 테스트 (관리자 → /b2b/buyers 페이지 로드, 고객 생성/수정/삭제)

- [ ] **최종 검증**
  - [ ] buyers 페이지에서 /api/b2b GET 호출 성공
  - [ ] 신규 B2B 고객 생성 API 응답 200/201
  - [ ] OWNER 권한 검증 (다른 조직 접근 시 403)
  - [ ] 중복 신청 48시간 체크 작동

---

## 예상 시간 배분

| Phase | 작업 | 시간 |
|-------|------|------|
| 1 | Prisma 스키마 정의 | 30분 |
| 1 | /api/b2b 엔드포인트 (GET/POST) | 45분 |
| 1 | /api/b2b/[id] 엔드포인트 (GET/PATCH/DELETE) | 45분 |
| 2 | DEFAULT_ORGANIZATION_ID 제거 | 20분 |
| 2 | 트랜잭션 래핑 + 48시간 중복 체크 | 40분 |
| 3 | 단위 테스트 작성 | 30분 |
| 3 | 수동 테스트 + 수정 | 30분 |
| **합계** | | **5h** |

---

**다음 단계**: Step 5 (사용자 승인) 대기 → Step 6 (구현 시작)
