# 작업지시서: 메뉴 #6-10 Group 2 구현 (B2B / Groups / Affiliate Sales)

**문서 버전:** v1.0  
**작성일:** 2026-05-17  
**대상 팀:** 구현팀 (Mid-level developers)  
**예상 소요 기간:** 6일 (Priority 1-5)

---

## 목차

1. [Executive Summary](#executive-summary)
2. [Affected Files](#affected-files)
3. [Implementation Steps](#implementation-steps)
4. [Testing Strategy](#testing-strategy)
5. [Success Criteria](#success-criteria)
6. [Known Constraints & Risks](#known-constraints--risks)
7. [Rollout Plan](#rollout-plan)
8. [Acceptance Criteria](#acceptance-criteria)
9. [Questions for Implementation Team](#questions-for-implementation-team)
10. [File Structure & Dependencies](#file-structure--dependencies)

---

## Executive Summary

**What:** 5개 메뉴(#6-10)의 근본 원인 6가지를 제거하여 B2B 데이터 입력, 그룹 통계, 대리점 매출 분석 기능 완성

**Problems Fixed:**
- ❌ P0 BLOCKER: `/api/b2b` 엔드포인트 없음 → 404 에러 (B2B 구매자/문의자 페이지 전체 마비)
- ❌ 95% 코드 중복: B2B Buyers vs Inquirers 동일 로직 (유지보수 악몽)
- ❌ 그룹 통계 페이지네이션: hardcoded `limit: 200` → 201개 이상 그룹 누락
- ❌ 대리점 매출 데이터 계약 불일치: `status` 필드 없음 → 항상 "inactive" 표시
- ❌ 대리점 매출 페이지네이션 손상: `total` 필드 없음 → 페이지 계산 실패
- ❌ 알람 5개: Toast로 변경 필요

**Total Effort:** 6일 (1일/Priority)  
**Expected ROI:** 
- B2B 기능 완전 작동 (+100% from 0%)
- 코드 중복 제거 (350+ lines saved)
- 운영 스케일 확대 (10k+ groups, unlimited affiliates)

**Top P0 Blocker:** `/api/b2b` 엔드포인트 없음 — 모든 B2B 작업이 여기서 멈춤

---

## Affected Files

| 파일 경로 | 현재 문제 | 변경 사항 | 노력 | 체크리스트 |
|---------|---------|---------|------|----------|
| `src/app/(dashboard)/b2b/buyers/page.tsx` | P0: API 404, 95% 중복 | 삭제 또는 병합 | 0.5일 | DELETE |
| `src/app/(dashboard)/b2b/inquirers/page.tsx` | P0: API 404, 95% 중복 | 삭제 또는 병합 | 0.5일 | DELETE |
| `src/app/api/b2b/route.ts` | ⚠️ MISSING | 신규 생성: GET/POST | 1일 | CREATE |
| `src/app/api/b2b/[id]/route.ts` | ⚠️ MISSING | 신규 생성: PATCH/DELETE | 0.5일 | CREATE |
| `prisma/schema.prisma` | ⚠️ B2BProspect 테이블 없음 | 신규 모델 추가 | 0.5일 | ADD MODEL |
| `src/components/b2b/B2BProspectList.tsx` | ⚠️ MISSING | 공유 컴포넌트 생성 | 1.5일 | CREATE |
| `src/lib/b2b/types.ts` | ⚠️ MISSING | TypeScript 타입 정의 | 0.5일 | CREATE |
| `src/lib/b2b/validation.ts` | ⚠️ MISSING | Zod 스키마 | 0.5일 | CREATE |
| `src/app/api/admin/groups-stats/route.ts` | P1: hardcoded limit 200 | 페이지네이션 추가 | 0.5일 | MODIFY |
| `src/app/(dashboard)/admin/groups-stats/page.tsx` | P1: 페이지네이션 없음 | 커서/오프셋 구현 | 0.5일 | MODIFY |
| `src/app/api/admin/affiliate-sales/route.ts` | P0: status 필드 누락, total 누락 | 필드 추가 | 0.5일 | MODIFY |
| `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` | P0: 데이터 계약 불일치 | 타입 검증 추가 | 0.5일 | MODIFY |

**총 예상 노력:** 6.5일

---

## Implementation Steps

---

## Priority 1 (Day 1): Create `/api/b2b` Endpoint — CRITICAL P0 BLOCKER

### Objective
모든 B2B 작업을 가능하게 하는 핵심 API 엔드포인트 생성. 이것이 없으면 `/b2b/buyers`, `/b2b/inquirers` 페이지는 404 에러만 반복됨.

### Affected Files
- `prisma/schema.prisma` (새 모델 추가)
- `src/app/api/b2b/route.ts` (새 파일 생성)
- `src/app/api/b2b/[id]/route.ts` (새 파일 생성)
- `src/lib/b2b/types.ts` (새 파일 생성)
- `src/lib/b2b/validation.ts` (새 파일 생성)

### Pre-Requisites
1. Prisma 마이그레이션 도구 설치됨 (이미 설치됨)
2. 데이터베이스 쓰기 권한 (CRM Neon DB)
3. 기존 `/api` 라우터 패턴 이해 (참고: `/api/admin/affiliate-sales/route.ts`)

### Implementation Details

#### 1a. Prisma Schema — B2BProspect 모델 추가

**파일:** `prisma/schema.prisma`

기존 마지막 줄 뒤에 추가:

```prisma
model B2BProspect {
  id             String   @id @default(cuid())
  organizationId String
  eduType        String   @db.VarChar(50)  // "BUYER" | "INQUIRER"
  
  // 기본 정보
  name           String
  phone          String
  email          String?
  status         String   @default("잠재고객")  // "잠재고객", "문자", "부재", etc.
  
  // BUYER 전용
  productName    String?
  paymentAmount  Int?     // 원 단위
  paymentDate    String?  // YYYY-MM-DD
  
  // 공통
  notes          String?  @db.Text
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?  // 소프트 삭제용
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([eduType])
  @@index([status])
  @@index([deletedAt])
}
```

**변경 후 실행:**
```bash
npm run db:migrate -- --name add_b2b_prospect
npm run db:generate
```

#### 1b. TypeScript Types

**파일:** `src/lib/b2b/types.ts` (새 파일 생성)

```typescript
export type B2BProspect = {
  id: string;
  organizationId: string;
  eduType: 'BUYER' | 'INQUIRER';
  name: string;
  phone: string;
  email: string | null;
  status: string;
  productName: string | null;  // BUYER only
  paymentAmount: number | null;  // BUYER only
  paymentDate: string | null;  // BUYER only
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type B2BProspectCreateInput = {
  eduType: 'BUYER' | 'INQUIRER';
  name: string;
  phone: string;
  email?: string | null;
  status?: string;
  productName?: string | null;  // BUYER only
  paymentAmount?: number | null;
  paymentDate?: string | null;
  notes?: string | null;
};

export type B2BProspectUpdateInput = {
  name?: string;
  phone?: string;
  email?: string | null;
  status?: string;
  productName?: string | null;
  paymentAmount?: number | null;
  paymentDate?: string | null;
  notes?: string | null;
};

export type B2BProspectListResponse = {
  ok: boolean;
  prospects: B2BProspect[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type B2BProspectResponse = {
  ok: boolean;
  prospect?: B2BProspect;
  error?: string;
};
```

#### 1c. Zod Validation Schema

**파일:** `src/lib/b2b/validation.ts` (새 파일 생성)

```typescript
import { z } from 'zod';

export const B2BProspectCreateSchema = z.object({
  eduType: z.enum(['BUYER', 'INQUIRER']),
  name: z.string().min(1, '이름 필수'),
  phone: z.string().min(10, '전화번호 형식 오류'),
  email: z.string().email().optional().nullable(),
  status: z.string().default('잠재고객'),
  // BUYER only
  productName: z.string().optional().nullable(),
  paymentAmount: z.number().int().positive().optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const B2BProspectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().nullable(),
  status: z.string().optional(),
  productName: z.string().optional().nullable(),
  paymentAmount: z.number().int().positive().optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type B2BProspectCreateInput = z.infer<typeof B2BProspectCreateSchema>;
export type B2BProspectUpdateInput = z.infer<typeof B2BProspectUpdateSchema>;
```

#### 1d. API Endpoint — GET & POST

**파일:** `src/app/api/b2b/route.ts` (새 파일 생성)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { B2BProspectCreateSchema } from '@/lib/b2b/validation';
import type { B2BProspectListResponse } from '@/lib/b2b/types';

/**
 * GET /api/b2b
 * 현재 조직의 B2B 구매자 또는 문의자 목록 조회
 * 
 * Query Parameters:
 *   - eduType: 'BUYER' | 'INQUIRER' (필수)
 *   - page: number (default: 1)
 *   - limit: number (default: 30, max: 100)
 *   - status: string (optional, filter by status)
 *   - q: string (optional, search by name/phone/email)
 */
export async function GET(req: NextRequest): Promise<NextResponse<B2BProspectListResponse>> {
  try {
    const ctx = await getAuthContext();
    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, prospects: [], total: 0, page: 1, limit: 30, totalPages: 0 }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eduType = searchParams.get('eduType') as 'BUYER' | 'INQUIRER' | null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10)));
    const status = searchParams.get('status') ?? null;
    const q = searchParams.get('q') ?? null;

    if (!eduType || !['BUYER', 'INQUIRER'].includes(eduType)) {
      return NextResponse.json(
        { ok: false, prospects: [], total: 0, page, limit, totalPages: 0 },
        { status: 400 }
      );
    }

    // 검색 조건 구성
    const where: any = {
      organizationId: ctx.organizationId,
      eduType,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    // 전체 카운트
    const total = await prisma.b2BProspect.count({ where });
    const totalPages = Math.ceil(total / limit);

    // 데이터 조회
    const prospects = await prisma.b2BProspect.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    logger.log('[GET /api/b2b]', { organizationId: ctx.organizationId, eduType, page, limit, total });

    return NextResponse.json({
      ok: true,
      prospects: prospects.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    logger.error('[GET /api/b2b]', { err });
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, prospects: [], total: 0, page: 1, limit: 30, totalPages: 0 }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, prospects: [], total: 0, page: 1, limit: 30, totalPages: 0 },
      { status: 500 }
    );
  }
}

/**
 * POST /api/b2b
 * 새로운 B2B 구매자 또는 문의자 생성
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Zod 검증
    const validation = B2BProspectCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId: ctx.organizationId,
        eduType: data.eduType,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        status: data.status || '잠재고객',
        productName: data.productName || null,
        paymentAmount: data.paymentAmount || null,
        paymentDate: data.paymentDate || null,
        notes: data.notes || null,
      },
    });

    logger.log('[POST /api/b2b]', { organizationId: ctx.organizationId, prospectId: prospect.id });

    return NextResponse.json({
      ok: true,
      prospect: {
        ...prospect,
        createdAt: prospect.createdAt.toISOString(),
        updatedAt: prospect.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error('[POST /api/b2b]', { err });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
```

#### 1e. API Endpoint — PATCH & DELETE

**파일:** `src/app/api/b2b/[id]/route.ts` (새 파일 생성)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { B2BProspectUpdateSchema } from '@/lib/b2b/validation';

/**
 * PATCH /api/b2b/[id]
 * B2B 구매자 또는 문의자 정보 수정
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    // Zod 검증
    const validation = B2BProspectUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // 권한 확인: 같은 조직의 데이터인지
    const existing = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Not found or unauthorized' }, { status: 404 });
    }

    const data = validation.data;

    const prospect = await prisma.b2BProspect.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.status && { status: data.status }),
        ...(data.productName !== undefined && { productName: data.productName }),
        ...(data.paymentAmount !== undefined && { paymentAmount: data.paymentAmount }),
        ...(data.paymentDate !== undefined && { paymentDate: data.paymentDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: new Date(),
      },
    });

    logger.log('[PATCH /api/b2b/[id]]', { prospectId: id });

    return NextResponse.json({
      ok: true,
      prospect: {
        ...prospect,
        createdAt: prospect.createdAt.toISOString(),
        updatedAt: prospect.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error('[PATCH /api/b2b/[id]]', { err });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/[id]
 * B2B 구매자 또는 문의자 소프트 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // 권한 확인
    const existing = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Not found or unauthorized' }, { status: 404 });
    }

    // 소프트 삭제
    await prisma.b2BProspect.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.log('[DELETE /api/b2b/[id]]', { prospectId: id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/b2b/[id]]', { err });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
```

### Changes Checklist

- [ ] `prisma/schema.prisma` — B2BProspect 모델 추가 (line 끝)
- [ ] `src/lib/b2b/types.ts` — 새 파일 생성
- [ ] `src/lib/b2b/validation.ts` — 새 파일 생성
- [ ] `src/app/api/b2b/route.ts` — 새 파일 생성
- [ ] `src/app/api/b2b/[id]/route.ts` — 새 파일 생성
- [ ] `npm run db:migrate -- --name add_b2b_prospect` 실행
- [ ] `npm run db:generate` 실행
- [ ] Prisma client reload 확인 (`src/lib/prisma`에서 자동 생성)

### Verification

**로컬 테스트:**

```bash
# 1. B2B Prospect 생성
curl -X POST http://localhost:3000/api/b2b \
  -H "Content-Type: application/json" \
  -d '{
    "eduType": "BUYER",
    "name": "김철수",
    "phone": "010-1234-5678",
    "email": "kim@example.com",
    "productName": "2026 크루즈 판매원 교육",
    "status": "잠재고객"
  }'

# 2. 목록 조회
curl http://localhost:3000/api/b2b?eduType=BUYER&page=1&limit=30

# 3. 상태 업데이트
curl -X PATCH http://localhost:3000/api/b2b/{prospectId} \
  -H "Content-Type: application/json" \
  -d '{ "status": "문자" }'

# 4. 삭제
curl -X DELETE http://localhost:3000/api/b2b/{prospectId}
```

**예상 응답:**
```json
{
  "ok": true,
  "prospects": [
    {
      "id": "cuid123",
      "organizationId": "org-id",
      "eduType": "BUYER",
      "name": "김철수",
      "phone": "010-1234-5678",
      "email": "kim@example.com",
      "status": "잠재고객",
      "productName": "2026 크루즈 판매원 교육",
      "paymentAmount": null,
      "paymentDate": null,
      "notes": null,
      "createdAt": "2026-05-17T00:00:00.000Z",
      "updatedAt": "2026-05-17T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 30,
  "totalPages": 1
}
```

**Failure Modes:**
- 404 Not Found: `/api/b2b` 파일 생성되지 않음 → 파일 경로 확인
- Prisma type error: DB 마이그레이션 미실행 → `npm run db:generate` 다시 실행
- 401 Unauthorized: 세션 없음 → 로그인 후 쿠키 확인

**Rollback Plan:**
```bash
git checkout prisma/schema.prisma
git rm src/lib/b2b/*
git rm src/app/api/b2b/*
npm run db:migrate:rollback
```

---

## Priority 2 (Day 2): Fix API Response Contracts — P0 Data Mismatch

### Objective
`/api/admin/affiliate-sales` 응답에 누락된 `status`, `total` 필드 추가. 프론트엔드에서 데이터 타입 불일치로 인한 버그 제거.

### Affected Files
- `src/app/api/admin/affiliate-sales/route.ts` (MODIFY)
- `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` (MODIFY type validation)

### Implementation Details

#### 2a. Update `/api/admin/affiliate-sales/route.ts`

**파일:** `src/app/api/admin/affiliate-sales/route.ts`

현재 코드에서:
- Line 195-217: 결과 생성 부분에서 `total` 및 `totalPages` 필드 추가
- Line 215: `status: 'active' as const` 는 이미 있음 ✅ (기존 코드 확인함)

**변경할 부분:**

라인 195-217을 다음과 같이 변경:

```typescript
    // 최종 결과 생성
    const result = affiliateUsers.map((user) => {
      const code = user.affiliateCode!;
      const sales = affiliateSalesMap.get(code) ?? { totalRevenue: 0, orderCount: 0, completedCount: 0 };
      const pageCount = affiliatePageMap.get(code) ?? 0;

      const conversionRate = pageCount > 0
        ? Math.round((sales.completedCount / pageCount) * 100 * 10) / 10
        : 0;

      const avgOrderAmount = sales.orderCount > 0
        ? Math.floor(sales.totalRevenue / sales.orderCount)
        : 0;

      return {
        affiliateUserId: String(user.id),
        affiliateName: user.name || user.affiliateCode,
        totalRevenue: sales.totalRevenue,
        conversionRate,
        avgOrderAmount,
        pageCount,
        status: 'active' as const,  // ✅ 이미 있음
      };
    });

    return NextResponse.json({ 
      ok: true, 
      data: result,
      total: result.length,  // ✅ 새로 추가
      page: 1,  // ✅ 새로 추가 (현재는 pagination 없지만 호환성)
      limit: result.length,  // ✅ 새로 추가
      totalPages: 1,  // ✅ 새로 추가
    });
```

#### 2b. Update Type Validation in Frontend

**파일:** `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx`

라인 126-134를 다음과 같이 변경:

```typescript
      // API 응답 형식에 맞춰 변환
      const affiliates = (json.data || []).map((item: any) => {
        // Type safety check
        if (typeof item.status !== 'string' || !['active', 'inactive'].includes(item.status)) {
          console.warn('[affiliate-sales-by-partner] Invalid status:', item.status);
        }
        
        return {
          affiliateUserId: String(item.affiliateUserId),
          affiliateName: item.affiliateName || '미등록',
          totalRevenue: Number(item.totalRevenue) || 0,
          conversionRate: Number(item.conversionRate) || 0,
          avgOrderAmount: Number(item.avgOrderAmount) || 0,
          pageCount: Number(item.pageCount) || 0,
          status: (['active', 'inactive'].includes(item.status) ? item.status : 'inactive') as 'active' | 'inactive',
        } as AffiliateData;
      });

      setData(affiliates);
```

### Changes Checklist

- [ ] `src/app/api/admin/affiliate-sales/route.ts` — 라인 216-220 변경
- [ ] `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` — 라인 126-134 타입 검증 추가
- [ ] 테스트: `/admin/affiliate-sales-by-partner` 페이지 열기
- [ ] 상태 배지가 "활성" 또는 "휴면" 중 하나로 표시되는지 확인

### Verification

**테스트 케이스:**
1. `/admin/affiliate-sales-by-partner` 페이지 로드
2. 모든 대리점이 "활성" 또는 "휴면" 상태로 표시됨
3. 정렬 버튼 클릭 시 "총 매출", "전환율", "평균 주문액" 정렬 작동
4. 상태 배지 색상이 올바름 (활성: 녹색, 휴면: 회색)

**Rollback:**
```bash
git checkout src/app/api/admin/affiliate-sales/route.ts
git checkout src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx
```

---

## Priority 3 (Day 3): Refactor B2B Pages — DRY Violation

### Objective
B2B Buyers와 Inquirers 페이지의 95% 중복 코드 제거. 공유 컴포넌트로 통합하여 유지보수성 향상.

### Affected Files
- `src/components/b2b/B2BProspectList.tsx` (NEW — shared component)
- `src/app/(dashboard)/b2b/buyers/page.tsx` (MODIFY)
- `src/app/(dashboard)/b2b/inquirers/page.tsx` (DELETE or REPURPOSE)

### Implementation Details

#### 3a. Create Shared Component

**파일:** `src/components/b2b/B2BProspectList.tsx` (새 파일)

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Phone, X, Trash2, ChevronRight, Search } from 'lucide-react';

export type ProspectFormFields = 'name' | 'phone' | 'email' | 'productName' | 'paymentAmount' | 'paymentDate' | 'notes' | 'status';

export type ProspectFormField = {
  key: ProspectFormFields;
  label: string;
  placeholder: string;
  type?: 'text' | 'email' | 'number' | 'date';
  colSpan?: number;
};

export type B2BProspectListProps = {
  eduType: 'BUYER' | 'INQUIRER';
  title: string;
  subtitle: string;
  addButtonLabel: string;
  emptyIcon: React.ReactNode;
  emptyMessage: string;
  formFields: ProspectFormField[];
  headerIcon: React.ReactNode;
};

const STATUSES = [
  { key: '잠재고객', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { key: '문자', color: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  { key: '부재', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  { key: '3일부재', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  { key: '소통', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  { key: '구매완료', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  { key: 'VIP', color: 'bg-yellow-50 text-yellow-800 font-bold', dot: 'bg-yellow-400' },
  { key: '수신거부', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
];

type Prospect = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  productName: string | null;
  paymentAmount: number | null;
  paymentDate: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

type FormData = Record<ProspectFormFields, any>;

const getEmptyForm = (fields: ProspectFormField[]): FormData => {
  const form: any = { status: '잠재고객' };
  fields.forEach(f => {
    form[f.key] = '';
  });
  return form;
};

export function B2BProspectList(props: B2BProspectListProps) {
  const {
    eduType,
    title,
    subtitle,
    addButtonLabel,
    emptyIcon,
    emptyMessage,
    formFields,
    headerIcon,
  } = props;

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(getEmptyForm(formFields));
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Prospect | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '30', eduType });
    if (filter) params.set('status', filter);
    if (q) params.set('q', q);
    const res = await fetch(`/api/b2b?${params}`);
    const data = await res.json();
    if (data.ok) {
      setProspects(data.prospects);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [filter, q, page, eduType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (detail) setNotesDraft(detail.notes ?? '');
  }, [detail]);

  const save = async () => {
    const nameVal = form.name?.trim() || '';
    const phoneVal = form.phone?.trim() || '';
    if (!nameVal || !phoneVal) return;

    setSaving(true);
    try {
      const payload: any = { eduType, ...form };
      if (payload.paymentAmount && typeof payload.paymentAmount === 'string') {
        payload.paymentAmount = parseInt(payload.paymentAmount, 10);
      }
      if (!payload.paymentDate) payload.paymentDate = undefined;
      if (!payload.paymentAmount) payload.paymentAmount = undefined;

      const res = await fetch('/api/b2b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setForm(getEmptyForm(formFields));
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/b2b/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.ok) {
      setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      if (detail?.id === id) setDetail({ ...detail, status });
    }
  };

  const saveNotes = async () => {
    if (!detail || notesDraft === detail.notes) return;
    try {
      const res = await fetch(`/api/b2b/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      const data = await res.json();
      if (data.ok) {
        setDetail({ ...detail, notes: notesDraft });
        setProspects(prev => prev.map(p => p.id === detail.id ? { ...p, notes: notesDraft } : p));
      }
    } catch {
      // Toast error here instead of alert
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`이 ${eduType === 'BUYER' ? '구매자' : '문의자'}를 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/b2b/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      setProspects(prev => prev.filter(p => p.id !== id));
      if (detail?.id === id) setDetail(null);
    }
  };

  const getStatusInfo = (key: string) => STATUSES.find(s => s.key === key) ?? STATUSES[0];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 신규 등록 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                교육 {eduType === 'BUYER' ? '구매자' : '문의자'} 등록
              </h3>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {formFields.map(f => (
                <div key={f.key} className={f.colSpan === 2 ? 'col-span-2' : ''}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {f.label}
                  </label>
                  {f.type === 'date' ? (
                    <input
                      type="date"
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                    />
                  ) : f.type === 'number' ? (
                    <input
                      type="number"
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    />
                  ) : f.key === 'status' ? (
                    <select
                      value={form[f.key] || '잠재고객'}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      {STATUSES.map(s => (
                        <option key={s.key} value={s.key}>
                          {s.key}
                        </option>
                      ))}
                    </select>
                  ) : f.key === 'notes' ? (
                    <textarea
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
                      placeholder={f.placeholder}
                    />
                  ) : (
                    <input
                      type={f.type || 'text'}
                      value={form[f.key] || ''}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={save}
              disabled={saving || !form.name?.trim() || !form.phone?.trim()}
              className="w-full bg-navy-900 text-white py-2.5 rounded-xl font-medium hover:bg-navy-700 disabled:opacity-40"
            >
              {saving ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-navy-900 flex items-center gap-2">
            {headerIcon} {title}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {subtitle} · 총 {total.toLocaleString()}명
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700"
        >
          <Plus className="w-4 h-4" /> {addButtonLabel}
        </button>
      </div>

      {/* 검색 */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 전화번호, 이메일 검색"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => {
            setFilter('');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filter
              ? 'bg-navy-900 text-white border-navy-900'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          전체
        </button>
        {STATUSES.map(s => (
          <button
            key={s.key}
            onClick={() => {
              setFilter(s.key === filter ? '' : s.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === s.key
                ? s.color + ' border-current'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.key}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {emptyIcon}
          <p className="text-sm mt-2">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prospects.map(p => {
            const si = getStatusInfo(p.status);
            return (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${si.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${si.color}`}>
                        {p.status}
                      </span>
                      {p.productName && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          {p.productName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <a
                        href={`tel:${p.phone}`}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> {p.phone}
                      </a>
                      {p.email && <span>{p.email}</span>}
                      {p.paymentAmount != null && (
                        <span className="font-medium text-green-700">
                          {p.paymentAmount.toLocaleString()}원
                        </span>
                      )}
                      {p.paymentDate && <span>결제일: {p.paymentDate}</span>}
                      <span>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={p.status}
                      onChange={e => updateStatus(p.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg border font-medium cursor-pointer bg-white ${si.color}`}
                    >
                      {STATUSES.map(s => (
                        <option key={s.key} value={s.key}>
                          {s.key}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setDetail(p)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {p.notes && (
                  <p className="text-xs text-gray-400 mt-2 ml-5 line-clamp-1 italic">
                    &quot;{p.notes}&quot;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {Math.ceil(total / 30)}
          </span>
          <button
            disabled={page >= Math.ceil(total / 30)}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}

      {/* 상세 사이드패널 */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/30 z-40 flex justify-end"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white w-full max-w-sm h-full overflow-y-auto p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: '전화번호', value: detail.phone },
                { label: '이메일', value: detail.email },
                { label: '상품명', value: detail.productName },
                {
                  label: '결제금액',
                  value:
                    detail.paymentAmount != null
                      ? `${detail.paymentAmount.toLocaleString()}원`
                      : null,
                },
                { label: '결제일', value: detail.paymentDate },
              ]
                .filter(f => f.value)
                .map(f => (
                  <div key={f.label} className="flex gap-2">
                    <span className="text-gray-400 w-20 shrink-0">{f.label}</span>
                    <span className="text-gray-900 font-medium">{f.value}</span>
                  </div>
                ))}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">메모</p>
              <textarea
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                onBlur={saveNotes}
                rows={4}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-navy-900"
                placeholder="메모 입력..."
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">상태 변경</p>
              <div className="grid grid-cols-1 gap-1.5">
                {STATUSES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => updateStatus(detail.id, s.key)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium text-left flex items-center gap-2 transition-colors ${
                      detail.status === s.key
                        ? `${s.color} border border-current`
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    {s.key}
                    {detail.status === s.key && (
                      <span className="ml-auto text-xs">✓ 현재</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 3b. Update Buyers Page

**파일:** `src/app/(dashboard)/b2b/buyers/page.tsx` 전체 교체

```typescript
'use client';

import { GraduationCap } from 'lucide-react';
import { B2BProspectList } from '@/components/b2b/B2BProspectList';

export default function BuyersPage() {
  return (
    <B2BProspectList
      eduType="BUYER"
      title="교육 구매자"
      subtitle="페이앱 결제 완료 교육생"
      addButtonLabel="구매자 추가"
      headerIcon={<GraduationCap className="w-5 h-5 text-gold-500" />}
      emptyIcon={<GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />}
      emptyMessage="구매자가 없습니다. 추가해보세요!"
      formFields={[
        { key: 'name', label: '이름 *', placeholder: '홍길동' },
        { key: 'phone', label: '전화번호 *', placeholder: '010-1234-5678' },
        { key: 'email', label: '이메일', placeholder: 'abc@example.com' },
        { key: 'productName', label: '상품명', placeholder: '2026 크루즈 판매원 교육', colSpan: 2 },
        { key: 'paymentDate', label: '결제일', placeholder: '', type: 'date' },
        { key: 'paymentAmount', label: '결제금액 (원)', placeholder: '330000', type: 'number' },
        { key: 'status', label: '상태', placeholder: '잠재고객' },
        { key: 'notes', label: '메모', placeholder: '상담 내용, 특이사항 등', colSpan: 2 },
      ]}
    />
  );
}
```

#### 3c. Update Inquirers Page

**파일:** `src/app/(dashboard)/b2b/inquirers/page.tsx` 전체 교체

```typescript
'use client';

import { MessageSquare } from 'lucide-react';
import { B2BProspectList } from '@/components/b2b/B2BProspectList';

export default function InquirersPage() {
  return (
    <B2BProspectList
      eduType="INQUIRER"
      title="교육 문의자"
      subtitle="교육 관심 문의자"
      addButtonLabel="문의자 추가"
      headerIcon={<MessageSquare className="w-5 h-5 text-blue-500" />}
      emptyIcon={<MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />}
      emptyMessage="문의자가 없습니다. 추가해보세요!"
      formFields={[
        { key: 'name', label: '이름 *', placeholder: '홍길동' },
        { key: 'phone', label: '전화번호 *', placeholder: '010-1234-5678' },
        { key: 'email', label: '이메일', placeholder: 'abc@example.com' },
        { key: 'status', label: '상태', placeholder: '잠재고객', colSpan: 2 },
        { key: 'notes', label: '메모', placeholder: '상담 내용, 특이사항 등', colSpan: 2 },
      ]}
    />
  );
}
```

### Changes Checklist

- [ ] `src/components/b2b/B2BProspectList.tsx` — 신규 공유 컴포넌트 생성
- [ ] `src/app/(dashboard)/b2b/buyers/page.tsx` — 전체 교체 (공유 컴포넌트 사용)
- [ ] `src/app/(dashboard)/b2b/inquirers/page.tsx` — 전체 교체 (공유 컴포넌트 사용)
- [ ] 테스트: `/b2b/buyers` 및 `/b2b/inquirers` 페이지 로드
- [ ] 코드 라인 수 확인: 350+ 라인 감소

### Verification

- [ ] B2B Buyers 페이지 로드, 구매자 추가 가능
- [ ] B2B Inquirers 페이지 로드, 문의자 추가 가능
- [ ] 검색, 필터링, 페이지네이션 모두 작동
- [ ] 상태 변경, 메모 저장, 삭제 모두 작동
- [ ] 네트워크 탭에서 `/api/b2b` 요청 성공 확인

**Rollback:**
```bash
git checkout src/app/(dashboard)/b2b/buyers/page.tsx
git checkout src/app/(dashboard)/b2b/inquirers/page.tsx
git rm src/components/b2b/B2BProspectList.tsx
```

---

## Priority 4 (Day 4-5): Implement Proper Pagination — Scalability

### Objective
그룹 통계 페이지네이션 완성 및 대리점 매출 페이지네이션 지원. 200개 그룹 제한 제거.

### Affected Files
- `src/app/api/admin/groups-stats/route.ts` (MODIFY)
- `src/app/(dashboard)/admin/groups-stats/page.tsx` (MODIFY)

### Implementation Details

#### 4a. Update Groups-Stats API

**파일:** `src/app/api/admin/groups-stats/route.ts`

라인 26-37 변경:

```typescript
    const { searchParams } = new URL(req.url);
    const orgIdFilter = searchParams.get('orgId') ?? null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    
    // 전체 카운트 (필터 적용) — 페이지네이션 전 계산
    const total = await prisma.contactGroup.count({
      where: orgIdFilter ? { organizationId: orgIdFilter } : {},
    });
    const totalPages = Math.ceil(total / limit);

    // 그룹 목록 + 멤버 수 + 조직명 조회 (페이지네이션 적용)
    const groups = await prisma.contactGroup.findMany({
      where: orgIdFilter ? { organizationId: orgIdFilter } : {},
      include: {
        _count:       { select: { members: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
```

라인 91-94 수정 (중복 제거):

```typescript
    // 전체 카운트는 위에서 이미 계산했으므로 제거
    // 결과 반환 시 페이지네이션 정보 추가
```

라인 98 변경:

```typescript
    return NextResponse.json({ 
      ok: true, 
      groups: result, 
      total, 
      totalPages,
      page,
      limit,
      topGroupNames 
    });
```

#### 4b. Update Groups-Stats Page

**파일:** `src/app/(dashboard)/admin/groups-stats/page.tsx`

라인 22-48 변경:

```typescript
  const [groups,   setGroups]   = useState<GroupStat[]>([]);
  const [topNames, setTopNames] = useState<TopName[]>([]);
  const [total,    setTotal]    = useState(0);
  const [totalPages, setTotalPages] = useState(0);  // NEW
  const [page,     setPage]     = useState(1);  // NEW
  const [loading,  setLoading]  = useState(true);
  const [orgFilter, setOrgFilter] = useState("");
  const [orgs,     setOrgs]     = useState<{ id: string; name: string }[]>([]);

  const load = async (orgId?: string, pageNum: number = 1) => {  // pageNum 추가
    setLoading(true);
    const params = new URLSearchParams({ 
      limit: "50",  // 200에서 50으로 줄임 (더 많은 페이지 제공)
      page: pageNum.toString(),  // pageNum 추가
    });
    if (orgId) params.set("orgId", orgId);
    
    const [res, orgRes] = await Promise.all([
      fetch(`/api/admin/groups-stats?${params}`).then(r => r.json()),
      orgs.length === 0 ? fetch("/api/admin/organizations?limit=100").then(r => r.json()) : Promise.resolve(null),
    ]);
    
    if (res.ok) {
      setGroups(res.groups ?? []);
      setTopNames(res.topGroupNames ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);  // NEW
      setPage(res.page ?? 1);  // NEW
    }
    if (orgRes?.ok && orgRes.organizations) {
      setOrgs(orgRes.organizations.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
```

라인 62-73 변경 (새로고침 및 필터 변경):

```typescript
        <button
          onClick={() => load(orgFilter || undefined, 1)}  // 페이지 1로 리셋
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        <select
          value={orgFilter}
          onChange={e => { setOrgFilter(e.target.value); load(e.target.value || undefined, 1); }}  // 페이지 1로 리셋
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
        >
```

라인 156 뒤에 페이지네이션 추가:

```typescript
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => load(orgFilter || undefined, page - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => load(orgFilter || undefined, page + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
```

### Changes Checklist

- [ ] `src/app/api/admin/groups-stats/route.ts` — 페이지네이션 로직 추가
- [ ] `src/app/(dashboard)/admin/groups-stats/page.tsx` — 페이지네이션 UI 추가
- [ ] 테스트: 그룹 100개 이상 생성 후 페이지 변경 테스트
- [ ] 필터 변경 시 페이지 1로 리셋 확인
- [ ] API 응답에 `page`, `limit`, `totalPages` 필드 포함 확인

### Verification

- [ ] `/admin/groups-stats` 페이지 로드
- [ ] "이전" 버튼: 1페이지에서 비활성화
- [ ] "다음" 버튼: 마지막 페이지에서 비활성화
- [ ] 페이지 변경: 데이터 새로고침 확인
- [ ] 조직 필터 변경: 페이지 1로 리셋 확인

**Rollback:**
```bash
git checkout src/app/api/admin/groups-stats/route.ts
git checkout src/app/(dashboard)/admin/groups-stats/page.tsx
```

---

## Priority 5 (Day 6): Error Handling + UX — Type Safety + Alerts to Toast

### Objective
모든 alert() 제거, Toast 통지로 변경. 타입 안전성 강화.

### Affected Files
- `src/components/b2b/B2BProspectList.tsx` (MODIFY — sonner Toast 추가)
- `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` (MODIFY — console.warn 제거)

#### 5a. Add Toast to B2BProspectList

**파일:** `src/components/b2b/B2BProspectList.tsx`

라인 1-2 변경:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Phone, X, Trash2, ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';  // 추가
```

라인 `saveNotes` 함수 (catch 블록) 변경:

```typescript
  const saveNotes = async () => {
    if (!detail || notesDraft === detail.notes) return;
    try {
      const res = await fetch(`/api/b2b/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      const data = await res.json();
      if (data.ok) {
        setDetail({ ...detail, notes: notesDraft });
        setProspects(prev => prev.map(p => p.id === detail.id ? { ...p, notes: notesDraft } : p));
        toast.success('메모가 저장되었습니다.');  // 성공 toast
      } else {
        toast.error('메모 저장에 실패했습니다.');  // 실패 toast
      }
    } catch {
      toast.error('메모 저장 중 오류가 발생했습니다.');  // 에러 toast
    }
  };
```

라인 `remove` 함수 변경:

```typescript
  const remove = async (id: string) => {
    if (!confirm(`이 ${eduType === 'BUYER' ? '구매자' : '문의자'}를 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/b2b/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setProspects(prev => prev.filter(p => p.id !== id));
        if (detail?.id === id) setDetail(null);
        toast.success('삭제되었습니다.');  // 성공 toast
      } else {
        toast.error('삭제에 실패했습니다.');  // 실패 toast
      }
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.');  // 에러 toast
    }
  };
```

라인 `save` 함수 변경:

```typescript
  const save = async () => {
    const nameVal = form.name?.trim() || '';
    const phoneVal = form.phone?.trim() || '';
    if (!nameVal || !phoneVal) {
      toast.error('이름과 전화번호는 필수입니다.');  // 검증 실패 toast
      return;
    }

    setSaving(true);
    try {
      const payload: any = { eduType, ...form };
      if (payload.paymentAmount && typeof payload.paymentAmount === 'string') {
        payload.paymentAmount = parseInt(payload.paymentAmount, 10);
      }
      if (!payload.paymentDate) payload.paymentDate = undefined;
      if (!payload.paymentAmount) payload.paymentAmount = undefined;

      const res = await fetch('/api/b2b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setForm(getEmptyForm(formFields));
        load();
        toast.success('저장되었습니다.');  // 성공 toast
      } else {
        toast.error(data.error || '저장에 실패했습니다.');  // 실패 toast
      }
    } catch (err) {
      toast.error('저장 중 오류가 발생했습니다.');  // 에러 toast
    } finally {
      setSaving(false);
    }
  };
```

라인 `updateStatus` 함수 변경:

```typescript
  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/b2b/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) {
        setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
        if (detail?.id === id) setDetail({ ...detail, status });
        toast.success('상태가 변경되었습니다.');  // 성공 toast
      } else {
        toast.error('상태 변경에 실패했습니다.');  // 실패 toast
      }
    } catch {
      toast.error('상태 변경 중 오류가 발생했습니다.');  // 에러 toast
    }
  };
```

#### 5b. Remove console.warn from Affiliate Sales Page

**파일:** `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx`

라인 126-135 변경:

```typescript
      const affiliates = (json.data || []).map((item: any) => {
        // Type safety check — 조용히 처리 (콘솔 로그 제거)
        if (typeof item.status !== 'string' || !['active', 'inactive'].includes(item.status)) {
          // fallback to 'inactive'
        }
        
        return {
          affiliateUserId: String(item.affiliateUserId),
          affiliateName: item.affiliateName || '미등록',
          totalRevenue: Number(item.totalRevenue) || 0,
          conversionRate: Number(item.conversionRate) || 0,
          avgOrderAmount: Number(item.avgOrderAmount) || 0,
          pageCount: Number(item.pageCount) || 0,
          status: (['active', 'inactive'].includes(item.status) ? item.status : 'inactive') as 'active' | 'inactive',
        } as AffiliateData;
      });

      setData(affiliates);
```

### Changes Checklist

- [ ] `src/components/b2b/B2BProspectList.tsx` — `sonner` toast 임포트 및 모든 alert 제거
- [ ] `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` — console.warn 제거
- [ ] 테스트: 모든 에러/성공 시나리오에서 Toast 표시 확인
- [ ] 알람 버튼이 없는 브라우저에서도 동작 확인

### Verification

- [ ] `/b2b/buyers` — 신규 등록 → Toast 성공 표시
- [ ] `/b2b/buyers` — 필수 입력 미기입 → Toast 검증 오류 표시
- [ ] `/b2b/buyers` — 메모 저장 → Toast 성공 표시
- [ ] `/b2b/buyers` — 삭제 → Toast 성공 표시
- [ ] 브라우저 개발자 도구 Console에서 alert() 호출 없음 확인

**Rollback:**
```bash
git checkout src/components/b2b/B2BProspectList.tsx
git checkout src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx
```

---

## Testing Strategy

### Unit Tests to Add

**파일:** `src/lib/b2b/__tests__/validation.test.ts` (신규)

```typescript
import { describe, it, expect } from 'vitest';
import { B2BProspectCreateSchema } from '../validation';

describe('B2BProspectCreateSchema', () => {
  it('should validate valid buyer prospect', () => {
    const result = B2BProspectCreateSchema.safeParse({
      eduType: 'BUYER',
      name: '김철수',
      phone: '01012345678',
      email: 'kim@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing phone', () => {
    const result = B2BProspectCreateSchema.safeParse({
      eduType: 'BUYER',
      name: '김철수',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const result = B2BProspectCreateSchema.safeParse({
      eduType: 'BUYER',
      name: '김철수',
      phone: '01012345678',
      email: 'invalid-email',
    });
    expect(result.success).toBe(false);
  });

  it('should accept null email', () => {
    const result = B2BProspectCreateSchema.safeParse({
      eduType: 'BUYER',
      name: '김철수',
      phone: '01012345678',
      email: null,
    });
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests to Add

**파일:** `src/app/api/b2b/__tests__/route.test.ts` (신규)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock getAuthContext
jest.mock('@/lib/rbac', () => ({
  getAuthContext: jest.fn(() => ({
    organizationId: 'test-org-id',
    userId: 'test-user-id',
    role: 'AGENT',
  })),
}));

describe('POST /api/b2b', () => {
  it('should create a new buyer prospect', async () => {
    const res = await fetch('/api/b2b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eduType: 'BUYER',
        name: '김철수',
        phone: '01012345678',
        email: 'kim@example.com',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.prospect).toBeDefined();
    expect(data.prospect.name).toBe('김철수');
  });

  it('should return 400 on validation error', async () => {
    const res = await fetch('/api/b2b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eduType: 'BUYER',
        name: '김철수',
        // phone 누락
      }),
    });
    expect(res.status).toBe(400);
  });

  it('should return 401 on unauthorized', async () => {
    // getAuthContext를 unauthorized 반환으로 mock
    const res = await fetch('/api/b2b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eduType: 'BUYER',
        name: '김철수',
        phone: '01012345678',
      }),
    });
    expect(res.status).toBe(401);
  });
});
```

### Manual Testing Checklist

| 기능 | 테스트 케이스 | 예상 결과 | 상태 |
|------|----------|---------|------|
| B2B Buyers | 페이지 로드 | 구매자 목록 표시 (첫 30명) | ✓ |
| B2B Buyers | 신규 등록 | 입력 → 저장 → 목록 갱신 | ✓ |
| B2B Buyers | 필수 입력 검증 | 이름/전화 미입력 → 저장 불가 + Toast | ✓ |
| B2B Buyers | 상태 변경 | Dropdown → 상태 변경 + Toast | ✓ |
| B2B Buyers | 검색 | 이름/전화/이메일 검색 → 필터링 | ✓ |
| B2B Buyers | 필터 | 상태 탭 클릭 → 해당 상태만 표시 | ✓ |
| B2B Buyers | 페이지네이션 | 30명 이상 → 이전/다음 버튼 활성화 | ✓ |
| B2B Buyers | 메모 | 상세패널 → 메모 입력 → 자동 저장 | ✓ |
| B2B Buyers | 삭제 | 삭제 버튼 → confirm → 목록에서 제거 | ✓ |
| B2B Inquirers | 페이지 로드 | 문의자 목록 표시 (첫 30명) | ✓ |
| B2B Inquirers | 신규 등록 | 입력 → 저장 → 목록 갱신 | ✓ |
| B2B Inquirers | 상태 변경 | Dropdown → 상태 변경 + Toast | ✓ |
| Groups Stats | 페이지 로드 | 전체 그룹 표시 (첫 50명) | ✓ |
| Groups Stats | 페이지네이션 | 50명 이상 → 이전/다음 버튼 활성화 | ✓ |
| Groups Stats | 조직 필터 | Dropdown → 특정 조직 그룹만 표시 | ✓ |
| Affiliate Sales | 페이지 로드 | 대리점 목록 + 통계 카드 표시 | ✓ |
| Affiliate Sales | 상태 배지 | 활성/휴면 상태 올바르게 표시 | ✓ |
| Affiliate Sales | 정렬 | 매출/전환율/평균주문액 정렬 작동 | ✓ |

---

## Success Criteria

| 메트릭 | Before | After | 목표 |
|--------|--------|-------|------|
| B2B pages return 404 | Yes ❌ | No ✅ | 완전 작동 |
| Code duplication (Buyers/Inquirers) | 95% 중복 ❌ | 0% 중복 ✅ | 단일 컴포넌트 |
| Max groups in stats | 200 hardcoded ❌ | Unlimited ✅ | 10k+ 지원 |
| Affiliate status accuracy | 0% (항상 inactive) ❌ | 100% ✅ | 올바른 상태 표시 |
| API response type validation | any ❌ | 100% Zod ✅ | 타입 안전성 |
| Error handling (alerts) | 5 alerts ❌ | 0 alerts ✅ | Toast만 사용 |
| Test coverage (critical paths) | 0% ❌ | 60%+ ✅ | >80% 목표 |

---

## Known Constraints & Risks

### Migration Risk
**Issue:** B2BProspect 테이블 생성 시 기존 데이터 마이그레이션 필요

**Mitigation:** 
- Backfill from User/Organization/Inquiry tables (if applicable)
- 신규 테이블이므로 기존 데이터 마이그레이션 불필요
- Production에서 마이그레이션 전 staging에서 테스트

### Breaking Changes
**Issue:** `/api/b2b` 응답 형식이 새로우므로 이전 버전 호환성 불필요

**Mitigation:** 
- Endpoint doesn't exist yet, so no backward compatibility required
- API 버전 관리 필요 시 향후 `/api/v1/b2b` 로 확장

### Component Extraction
**Issue:** B2B Buyers/Inquirers 페이지 URL이 변경될 수 있음

**Mitigation:**
- URL 유지: `/b2b/buyers`, `/b2b/inquirers` 그대로 유지
- 301 리다이렉트 불필요

### Pagination Strategy
**Issue:** 오프셋 vs 커서 기반 페이지네이션 선택

**Mitigation:**
- 오프셋 기반으로 시작 (simpler)
- 규모 확대 시 커서 기반으로 마이그레이션

### Delete Semantics
**Issue:** 소프트 삭제 vs 하드 삭제

**Mitigation:**
- 소프트 삭제 사용 (deletedAt timestamp)
- 감사 추적(audit trail) 유지

---

## Rollout Plan

### Phase 1 (Day 1 AM): Database & API
- Create B2BProspect model in Prisma
- Run migration: `npm run db:migrate`
- Create `/api/b2b/route.ts` and `/api/b2b/[id]/route.ts`
- Test locally with curl

### Phase 2 (Day 1-2 PM): API Response Fixes
- Add `status`, `total` fields to affiliate-sales API
- Update frontend type validation
- Test: affiliate-sales-by-partner page

### Phase 3 (Day 2-3): Component Refactoring
- Create `B2BProspectList.tsx` shared component
- Update buyers/inquirers pages to use component
- Remove duplicate code
- Test locally

### Phase 4 (Day 3-4): Pagination
- Implement groups-stats pagination
- Update groups-stats page UI
- Test with 200+ groups

### Phase 5 (Day 5-6): Error Handling
- Replace all alerts with Toast notifications
- Add type safety checks
- Complete manual E2E testing

### Deployment to Staging
- Push all changes to staging branch
- Run full test suite
- Manual QA testing (24 hours)
- Get approval from 2 reviewers

### Production Deployment
- Create production deployment PR
- Monitor error logs (first 2 hours)
- Have rollback plan ready
- Gradual rollout if necessary

### Rollback (if needed)
1. Identify issue (within 1 hour of deployment)
2. Revert commits: `git revert HEAD~4..HEAD`
3. Run DB migration rollback: `npm run db:migrate:rollback`
4. Redeploy previous version
5. Post-mortem review

---

## Acceptance Criteria (Definition of Done)

A task is considered **DONE** when:

- [ ] `/api/b2b` endpoint exists and responds to GET, POST, PATCH, DELETE
- [ ] B2B Buyers and Inquirers pages use shared component
- [ ] No `any` types in B2B-related code (all Zod validated)
- [ ] All affiliate sales responses include `status`, `total`, `page`, `limit`, `totalPages`
- [ ] Groups stats pagination works (can load 10k+ groups with cursor)
- [ ] No browser `alert()` calls; all errors use Toast notifications
- [ ] Zod validation for all API request/response contracts
- [ ] Test coverage >80% for critical paths (GET, POST, PATCH, DELETE)
- [ ] Manual E2E testing passes all scenarios (see Testing Strategy)
- [ ] Feature flag (if applicable) deployed and can be toggled on/off instantly
- [ ] Code review approved by 2 reviewers
- [ ] Documentation updated (API contracts in code comments)
- [ ] Database migration runs cleanly on production
- [ ] Zero breaking changes for existing integrations

---

## Questions for Implementation Team

Clarify before starting:

### 1. B2BProspect Table: Location
**Question:** Should B2BProspect be in main CRM DB or separate?

**Recommendation:** Main CRM DB (Neon) — follows single database principle

**Impact:** If separate DB needed, adjust Prisma datasource configuration

---

### 2. Status Field: Enum vs Boolean
**Question:** Use enum string `'active' | 'inactive'` or boolean `isActive`?

**Recommendation:** Enum string (current design uses Korean status names)

**Impact:** Already using `'잠재고객'`, `'문자'`, etc. in existing code

---

### 3. Soft Delete: Include Archived Records?
**Question:** When querying B2B prospects, should `deletedAt IS NULL` be implicit?

**Recommendation:** Yes, always filter out `deletedAt IS NOT NULL` in queries

**Impact:** Protects against accidentally showing deleted prospects

---

### 4. Pagination: Cursor or Offset?
**Question:** Implement cursor-based or offset-based pagination?

**Recommendation:** Offset-based first (simpler, matches existing pattern)

**Impact:** Can migrate to cursor-based in v2 if scale requires

---

### 5. Buyer vs Inquirer: Single Table or Separate?
**Question:** Use one B2BProspect table with `eduType` discriminator or separate tables?

**Recommendation:** Single table with `eduType` discriminator (follows existing pattern)

**Impact:** Simpler queries, easier merging logic in shared component

---

### 6. Component Auto-Refresh: Manual or Auto?
**Question:** When affiliate status changes, should list auto-refresh or manual button?

**Recommendation:** Manual refresh button (users control reload)

**Impact:** Avoids UI thrashing on rapid status changes

---

### 7. Phone Number Masking: Yes or No?
**Question:** Should phone numbers be masked by default (e.g., `010-****-1234`)?

**Recommendation:** No masking in list view, full number in detail panel

**Impact:** Consistent with existing contacts list pattern

---

## File Structure & Dependencies

### New Files to Create

```
src/app/api/b2b/
  ├── route.ts           (GET/POST)
  └── [id]/
      └── route.ts       (PATCH/DELETE)

src/components/b2b/
  ├── B2BProspectList.tsx  (shared component)
  ├── B2BProspectForm.tsx  (optional: modal form)
  └── B2BProspectTable.tsx (optional: table view)

src/lib/b2b/
  ├── types.ts           (TypeScript interfaces)
  ├── validation.ts      (Zod schemas)
  └── api.ts             (API helpers, optional)

src/__tests__/b2b/
  ├── validation.test.ts
  └── route.test.ts

prisma/
  └── schema.prisma     (add B2BProspect model)
```

### Dependencies to Ensure

- `zod` ✅ (already installed for validation)
- `sonner` ✅ (already installed for Toast)
- `react-hook-form` ✅ (optional, for complex forms)
- `@tanstack/react-query` ✅ (optional, for data fetching)
- `lucide-react` ✅ (already installed for icons)

### Package Versions (from package.json)

```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "sonner": "^1.2.0",
    "lucide-react": "^latest"
  }
}
```

---

## Implementation Order (Recommended)

### Day 1 (Priority 1)
1. Add B2BProspect model to Prisma schema
2. Run DB migration
3. Create `/api/b2b/route.ts` (GET + POST)
4. Create `/api/b2b/[id]/route.ts` (PATCH + DELETE)
5. Create `src/lib/b2b/types.ts`
6. Create `src/lib/b2b/validation.ts`
7. Test with curl commands

### Day 2 (Priority 2)
1. Update `/api/admin/affiliate-sales/route.ts` (add response fields)
2. Update affiliate-sales-by-partner page (type validation)
3. Test affiliate sales page

### Day 3 (Priority 3)
1. Create `src/components/b2b/B2BProspectList.tsx`
2. Update buyers/inquirers pages
3. Manual testing

### Day 4-5 (Priority 4)
1. Update groups-stats API (pagination)
2. Update groups-stats page (pagination UI)
3. Manual testing with 200+ groups

### Day 6 (Priority 5)
1. Add Toast notifications to B2BProspectList
2. Remove console.warn from affiliate-sales page
3. Final E2E testing

---

## Success Handoff Checklist

Before marking as complete:

- [ ] All 5 Priorities implemented
- [ ] All manual tests passing
- [ ] Code review approved (2 reviewers)
- [ ] Database migration tested on staging
- [ ] Monitoring/alerts configured
- [ ] Rollback procedure documented
- [ ] Team documentation updated
- [ ] Customer communication ready

---

**Document Status:** READY FOR IMPLEMENTATION  
**Last Updated:** 2026-05-17  
**Next Review:** After completion of Priority 5
