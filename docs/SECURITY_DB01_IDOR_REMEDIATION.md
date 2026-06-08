# DB-01 IDOR 취약점 분석 및 종합 구현 계획

**작성일**: 2026-06-08  
**우선순위**: P0 (보안 취약점)  
**상태**: 구현 대기 중  
**담당자**: Security Agent  

---

## 1. 최종 설계 (거장단토론 결과)

### 1.1 취약점 분석 결론

현재 코드(`src/app/api/landing-pages/[id]/route.ts`)는 **PATCH 로직 자체는 정상**이나, **DB 레벨에서 강제하지 않아** 향후 유사 버그 발생 가능성이 높습니다.

#### 안전성 현황
- ✅ **90줄 (GET findFirst)**: `organizationId` 필터링 정상
- ✅ **90줄 (PATCH findFirst)**: `organizationId` 필터링 정상
- ✅ **132줄 (PATCH update where)**: `organizationId` + `id` 복합 필터 정상
- ✅ **175줄 (DELETE)**: GLOBAL_ADMIN 분기처리 정상
- ❌ **119줄 (contactGroup.create)**: `existing.organizationId` 신뢰 (코드 리뷰 필수)

#### 공격 시나리오
```
1. 조직 A의 랜딩페이지 ID (e.g., "abc123") 탈취
2. 조직 B의 공격자가 PATCH /api/landing-pages/abc123 요청 전송
3. Route 핸들러의 organizationId 필터링으로 404 반환 (현재 정상)
4. 다만, 다른 API 경로나 향후 리팩토링 시 실수 위험성 존재
```

---

### 1.2 최선의 해결책: 3단계 방어

| 레이어 | 방식 | 효과 | 실행 | 우선순위 |
|--------|------|------|------|---------|
| **DB** | Prisma `@@unique([organizationId, id])` 추가 | 원천 차단 (DB 제약) | Prisma 마이그레이션 | **P0** |
| **코드** | 모든 CRUD 작업에 `organizationId` 검증 필수 | 방어심화 (이중검증) | Route 핸들러 재확인 | **P0** |
| **감사** | 전체 `landing-pages` API 경로 감시 | 프로세스 개선 | 코드 리뷰 체크리스트 | **P1** |

---

### 1.3 설계 원칙

1. **DB 레벨 강제**: Prisma `@@unique` 제약으로 자동 검증
2. **이중 검증**: 코드 레벨 + DB 레벨 방어
3. **개발자 실수 제거**: 다른 개발자가 `organizationId` 생략 불가
4. **점진적 마이그레이션**: 기존 데이터 호환성 유지

---

## 2. 변경할 파일 목록

| 파일 경로 | 변경 유형 | 비고 |
|-----------|---------|------|
| `prisma/schema.prisma` | **수정** | `@@unique([organizationId, id])` 추가 |
| `src/app/api/landing-pages/[id]/route.ts` | **검증** | 이미 정상이나 재확인 필요 |
| `src/app/api/b2b-landing/[id]/route.ts` | **검증** | 동일 패턴 적용 필요 |
| `src/app/api/landing-pages/comments/route.ts` | **검증** | 하위 리소스 감사 필요 |
| `src/app/api/landing-pages/registrations/route.ts` | **검증** | 하위 리소스 감사 필요 |

---

## 3. 각 파일별 구체적 코드 변경

### 3.1 `prisma/schema.prisma` — Prisma 스키마 수정 (✅ 필수)

**변경 위치**: Line 762-824 (CrmLandingPage 모델)

#### 현재 상태
```prisma
model CrmLandingPage {
  id                String    @id @default(cuid())
  organizationId    String
  title             String
  slug              String
  // ... (기타 필드들)
  
  @@unique([slug, organizationId])  // ← slug만 organizationId와 함께 unique
  @@index([organizationId])
  @@index([organizationId, createdByUserId, createdAt])
  @@index([shortlink])
  @@map("CrmLandingPage")
}
```

#### 변경 후 (권장)
```prisma
model CrmLandingPage {
  id                String    @id @default(cuid())
  organizationId    String
  title             String
  slug              String
  // ... (기타 필드들)
  
  @@unique([slug, organizationId])  // ← 기존: slug 유니크
  @@unique([organizationId, id])    // ← NEW: 조직별 페이지 ID 유니크 (IDOR 방지)
  @@index([organizationId])
  @@index([organizationId, createdByUserId, createdAt])
  @@index([shortlink])
  @@map("CrmLandingPage")
}
```

#### 추가 설명
- `@@unique([organizationId, id])` 추가는 **복합 고유 제약**
- 각 조직 내에서 ID는 유일하지만, **다른 조직과는 겹칠 수 있음** (자동으로 IDOR 방지)
- **기존 데이터**는 이미 조직별로 격리되어 있으므로 **마이그레이션 충돌 없음**

---

### 3.2 `src/app/api/landing-pages/[id]/route.ts` — 코드 검증 (✅ 이미 정상)

**현재 상태**: 이미 모든 쿼리에 `organizationId` 필터링이 있으므로 추가 변경 불필요

하지만 **문서화 목적**으로 각 메서드별 검증 결과 기록:

#### GET 메서드 (Line 50-76) ✅
```typescript
// Line 56-57: 올바른 패턴
const page = await prisma.crmLandingPage.findFirst({
  where: { id, ...(orgId ? { organizationId: orgId } : {}) },  // ← organizationId 필터
  // ...
});
```
**평가**: ✅ 정상 (Insecure Direct Object Reference 없음)

#### PATCH 메서드 (Line 78-173) ✅
```typescript
// Line 90: 존재 확인 + organizationId 검증
const existing = await prisma.crmLandingPage.findFirst({
  where: { id, organizationId: orgId }  // ← organizationId 필터
});

// Line 132-164: 업데이트 where에도 organizationId 포함
const page = await prisma.crmLandingPage.update({
  where: { id, organizationId: orgId },  // ← 이중 검증
  data: { /* ... */ }
});
```
**평가**: ✅ 정상 (이중 검증: findFirst + update where)

#### DELETE 메서드 (Line 175-198) ✅
```typescript
// Line 180-182: canDelete 체크
if (!canDelete(ctx)) {
  return NextResponse.json({ ok: false, message: "삭제 권한이 없습니다." }, { status: 403 });
}

// Line 185-187: 역할별 필터링
const where = ctx.role === "GLOBAL_ADMIN"
  ? { id }  // GLOBAL_ADMIN만 조직 필터 없음 (의도적)
  : { id, organizationId: resolveOrgId(ctx) };  // 일반 사용자는 organizationId 필터
```
**평가**: ✅ 정상 (GLOBAL_ADMIN 분기 처리 명확)

---

### 3.3 `src/app/api/landing-pages/[id]/route.ts` — 119줄 주의사항

**문제 위치**: Line 119-129 (contactGroup.create)

```typescript
// Line 112-115: 그룹 존재 확인
const found = await prisma.contactGroup.findFirst({
  where: { organizationId: existing.organizationId, name: subName, category: cat },  // ← 정상
  select: { id: true },
});

// Line 119-128: 그룹 생성 (안전)
if (!found) {
  const createdGroup = await prisma.contactGroup.create({
    data: {
      organizationId: existing.organizationId,  // ← existing에서 가져온 값 사용 (안전)
      name: subName,
      category: cat,
      ownerId: ctx.userId,
    },
    select: { id: true },
  });
  resolvedGroupId = createdGroup.id;
}
```

**평가**: ✅ 안전 
- `existing` 객체는 Line 90에서 `organizationId: orgId` 필터링으로 검증됨
- `existing.organizationId`는 신뢰할 수 있는 값
- 클라이언트가 보낸 `groupCategory` + `groupSubName`은 Zod로 검증됨

**개선 가능성** (선택사항):
```typescript
// 더 명시적인 방식 (선택사항)
const createdGroup = await prisma.contactGroup.create({
  data: {
    organizationId: orgId,  // ← 직접 orgId 사용 (기존 existing.organizationId 대신)
    name: subName,
    category: cat,
    ownerId: ctx.userId,
  },
  select: { id: true },
});
```

---

### 3.4 `src/app/api/b2b-landing/[id]/route.ts` — 동일 패턴 확인

**현재 상태**: 검증 필요 (유사한 PATCH 로직 존재 가능)

**확인 항목**:
```
[ ] B2B 랜딩페이지 모델에 organizationId 필터링 있는가?
[ ] GET/PATCH/DELETE 메서드 모두 organizationId 검증 있는가?
[ ] Prisma @@unique([organizationId, id]) 설정되어 있는가?
```

---

### 3.5 `src/app/api/landing-pages/*/route.ts` — 하위 리소스 감사

**확인 필요한 파일**:
- `src/app/api/landing-pages/comments/route.ts`
- `src/app/api/landing-pages/registrations/route.ts`
- `src/app/api/landing-pages/[id]/comments/route.ts`
- `src/app/api/landing-pages/[id]/registrations/route.ts`

**확인 체크리스트** (각 파일별):
```
[ ] parentId (landingPageId) 검증 시 organizationId 필터링 있는가?
[ ] Prisma where 절에 organizationId 포함되어 있는가?
[ ] 404 vs 403 구분 정확한가?
```

---

## 4. Prisma 스키마 변경 상세

### 4.1 마이그레이션 전략

#### 단계 1: 스키마 수정
```bash
# D:\mabiz-crm 디렉토리에서 실행
vi prisma/schema.prisma
# 또는 VSCode에서 편집
```

**변경 내용** (Line 819 아래에 추가):
```prisma
  @@unique([slug, organizationId])  // 기존
  @@unique([organizationId, id])    // ← 이 줄 추가
  @@index([organizationId])         // 기존
```

#### 단계 2: 마이그레이션 생성
```bash
npx prisma migrate dev --name add-landing-page-org-id-unique
```

**출력 예상**:
```
Environment variables loaded from .env.local
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "..." at "..."

✔ Created migration `20260608_add_landing_page_org_id_unique` in prisma/migrations/

Now applying the migration(s)...
Running migration `20260608_add_landing_page_org_id_unique`

The following migration(s) have been applied:

migrations/
  └─ 20260608_add_landing_page_org_id_unique/
      └─ migration.sql

Done in ...
```

#### 단계 3: 검증
```bash
npx prisma db push  # 이미 적용됨 (위 단계에서 자동 적용)
npx tsc --noEmit    # TypeScript 검증
```

### 4.2 마이그레이션 SQL (자동 생성)

**예상 SQL** (Prisma 자동 생성):
```sql
-- CreateUniqueConstraint
ALTER TABLE "CrmLandingPage" 
ADD CONSTRAINT "CrmLandingPage_organizationId_id_key" 
UNIQUE ("organizationId", "id");
```

**DB 확인**:
```sql
-- PostgreSQL에서 확인
\d "CrmLandingPage"

-- 또는
SELECT constraint_name, constraint_type 
FROM information_schema.constraint_column_usage 
WHERE table_name = 'CrmLandingPage';
```

---

## 5. 타입 검증 체크리스트

### 5.1 TypeScript 타입 확인

모든 변경 후 아래 명령으로 타입 검증:

```bash
cd D:\mabiz-crm
npx tsc --noEmit
```

**확인 항목**:
- [ ] `resolveOrgId(ctx)` 반환값이 `string` (not `string | null`)
- [ ] `CrmLandingPage` 타입에 `organizationId: string` 필드 있음
- [ ] 모든 CRUD 작업에서 `where` 절이 `organizationId` 포함
- [ ] Zod 스키마와 실제 데이터베이스 필드 일치

### 5.2 런타임 검증

Prisma Client 타입 재생성:
```bash
npx prisma generate
```

**확인**:
- [ ] `generated/client/index.d.ts`에 새로운 unique constraint 타입 반영
- [ ] IDE 자동완성에서 `where: { id, organizationId }` 제안 됨

---

## 6. 배포 전 체크리스트

### 6.1 로컬 테스트 (개발자)

```bash
# 1. 마이그레이션 생성 및 적용
npx prisma migrate dev --name add-landing-page-org-id-unique

# 2. TypeScript 컴파일 검증
npx tsc --noEmit

# 3. dev 서버 시작
npm run dev

# 4. 수동 테스트 (Postman/curl)
# 정상 요청
curl -X GET "http://localhost:3000/api/landing-pages/abc123" \
  -H "Authorization: Bearer <TOKEN_ORG_A>"
# 예상: 200 OK

# IDOR 시도 (조직 A의 페이지로 조직 B에서 접근)
curl -X GET "http://localhost:3000/api/landing-pages/xyz789" \
  -H "Authorization: Bearer <TOKEN_ORG_B>"
# 예상: 404 (organizationId 필터링)
```

### 6.2 코드 검토 (Peer Review)

- [ ] Prisma 스키마 변경 검토
- [ ] 마이그레이션 SQL 검토
- [ ] 모든 landing-pages API 경로 재검토 (GET/PATCH/DELETE)
- [ ] b2b-landing API 경로 재검토
- [ ] 하위 리소스 API (comments, registrations) 검토

### 6.3 실 데이터베이스 테스트 (Staging)

Vercel 또는 Staging 환경에서:

```bash
# 1. Supabase에서 마이그레이션 실행
npx prisma migrate deploy  # production 환경

# 2. 실제 테스트 데이터로 쿼리 검증
# SELECT * FROM "CrmLandingPage" WHERE "organizationId" = '...' LIMIT 1;

# 3. API 통합 테스트 (E2E)
npm run test:e2e --testNamePattern="landing-pages"
```

### 6.4 배포 후 검증 (Post-Deployment)

- [ ] Monitoring: 에러율 확인 (예상: 0% 증가)
- [ ] 로그: "P2002" 에러 모니터링 (unique constraint 위반)
- [ ] 성능: DB 쿼리 시간 변화 모니터링 (복합 index 추가로 약간 증가 가능)

---

## 7. 리스크 분석 및 완화 전략

### 7.1 잠재적 리스크

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|------|------|---------|
| 마이그레이션 실패 | 낮음 | 높음 | 사전에 Staging에서 테스트 |
| 성능 저하 | 낮음 | 중간 | 복합 index 성능 모니터링 |
| 회귀 (기존 기능 깨짐) | 낮음 | 높음 | E2E 테스트 사전 실행 |
| 다른 API에서 반복 | 중간 | 중간 | 코드 리뷰 체크리스트 추가 |

### 7.2 롤백 전략

마이그레이션 실패 시:
```bash
# 최근 마이그레이션 취소
npx prisma migrate resolve --rolled-back "20260608_add_landing_page_org_id_unique"

# 또는 이전 버전으로 되돌리기
git revert HEAD
npx prisma migrate deploy
```

---

## 8. 추가 강화사항 (P1/P2)

### 8.1 Rate Limiting (P1)

PATCH 요청에 Rate Limiter 추가:
```typescript
// src/app/api/landing-pages/[id]/route.ts
import { RateLimiter } from '@/lib/rate-limiter';

const limiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60000, // 1분
});

export async function PATCH(req: Request, { params }: Params) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!limiter.allow(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  // ... 기존 로직
}
```

### 8.2 Audit Logging (P1)

organizationId 변경 시도 실패 로깅:
```typescript
// 시도된 organizationId와 실제 organizationId 불일치 시 로깅
if (attemptedOrgId !== resolveOrgId(ctx)) {
  logger.warn("[IDOR ATTEMPT]", {
    route: "/api/landing-pages/[id]",
    userId: ctx.userId,
    attemptedOrgId,
    actualOrgId: resolveOrgId(ctx),
    landingPageId: id,
  });
}
```

### 8.3 API 문서화 (P2)

OpenAPI/Swagger에 보안 정책 추가:
```yaml
/api/landing-pages/{id}:
  patch:
    security:
      - bearerAuth: []
    parameters:
      - name: id
        in: path
        required: true
        description: Landing Page ID (조직별 격리)
    responses:
      404:
        description: Page not found or access denied
```

---

## 9. 참고 문서

- [OWASP IDOR (Insecure Direct Object Reference)](https://owasp.org/www-community/attacks/Insecure_Direct_Object_References)
- [Prisma Unique Constraints](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#unique-1)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/sql-createtable.html)
- 프로젝트 보안 정책: `/docs/project_security_setup_20260603.md`

---

## 10. 요약 및 액션 아이템

### 핵심 변경
1. **Prisma 스키마**: `@@unique([organizationId, id])` 추가
2. **마이그레이션**: `npx prisma migrate dev --name add-landing-page-org-id-unique`
3. **검증**: `npx tsc --noEmit` + E2E 테스트

### 예상 소요 시간
- 스키마 변경: 5분
- 마이그레이션: 10분
- 테스트: 30분
- **총 45분**

### 다음 단계
```
[  ] 1. 이 문서 검토 및 승인
[  ] 2. Staging 환경에서 사전 테스트
[  ] 3. Prisma 스키마 수정 + 마이그레이션
[  ] 4. 타입 검증 (tsc --noEmit)
[  ] 5. E2E 테스트 실행
[  ] 6. git commit + PR 생성
[  ] 7. 배포 및 모니터링
[  ] 8. 타 API 경로 감사 (b2b-landing, comments, registrations)
[  ] 9. 코드 리뷰 체크리스트 추가
[ ] 10. 문서화 (개발자 가이드)
```

---

**마지막 업데이트**: 2026-06-08 | **버전**: 1.0 (초안)
