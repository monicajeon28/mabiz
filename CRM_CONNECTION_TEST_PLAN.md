# CRM 연결 및 사용자 역할 테스트 계획
**작성일**: 2026-05-25  
**상태**: 초안  
**담당**: QA/Test Engineer

---

## 📋 Executive Summary

본 문서는 마비즈 CRM 시스템의 복구 이후 **모든 사용자 역할(Admin, Manager, Sales, Pre-Sales)**이 정상 작동하는지 검증하는 통합 테스트 계획입니다.

### 핵심 목표
- ✅ Clerk/NextAuth 인증 시스템 정상 작동
- ✅ 역할 기반 접근 제어(RBAC) 권한 검증
- ✅ CruiseDot 상품 API 연동 확인
- ✅ Neon DB ↔ CRM 데이터 동기화 검증
- ✅ 페이지 로딩 성능 (3초 이내)

---

## 🏗️ 시스템 아키텍처 개요

### 인증 시스템
```
┌─────────────────┐
│  Clerk OAuth    │ ← 기본 인증
├─────────────────┤
│ NextAuth (구)   │ ← 레거시 지원
├─────────────────┤
│ MabizSession    │ ← 세션 저장 (Neon DB)
└─────────────────┘
```

### 권한 체계
```
┌──────────────────────┐
│  GLOBAL_ADMIN (관리) │
│  - /admin/*          │
│  - /contracts/*      │
│  - 모든 메뉴 접근    │
└──────────────────────┘
         ↓
┌──────────────────────┐
│  MEMBER (대리점/판매)│
│  - /dashboard/*      │
│  - /contacts/*       │
│  - /campaigns/*      │
└──────────────────────┘
         ↓
┌──────────────────────┐
│  UNKNOWN (공개)      │
│  - /pnr/*            │
│  - 인증 불필요      │
└──────────────────────┘
```

### 데이터베이스 모델
**핵심 테이블**:
- `GlobalAdmin`: 전역 관리자 계정 (전체 시스템 제어)
- `OrganizationMember`: 조직 내 사용자 (역할: AGENT, OWNER, ADMIN)
- `MabizSession`: 세션 저장소 (JWT 대체)
- `Contact`: 고객 정보 (L0-L10 렌즈 데이터 포함)

---

## 👥 테스트 사용자 정의

### 1️⃣ Admin User (관리자)
**역할**: 전역 시스템 관리, 모든 조직 데이터 접근

| 속성 | 값 |
|------|-----|
| 계정타입 | `GlobalAdmin` |
| 권한 | `GLOBAL_ADMIN` |
| 테스트용 이메일 | `admin@mabiz.test` |
| 전화번호 | `010-0000-0001` |
| 접근 가능 경로 | `/admin/*`, `/contracts/*`, `/dashboard/*` |

**책임**:
- 조직 전체 보고서 조회
- 파트너 신청 승인/거부
- 시스템 설정 (SMS, 이메일 config)
- 사용자 계정 관리

---

### 2️⃣ Agent/Manager (대리점장)
**역할**: 자신의 조직 내 팀 관리 및 판매원 감독

| 속성 | 값 |
|------|-----|
| 계정타입 | `OrganizationMember` |
| 역할 | `AGENT` 또는 `OWNER` |
| 권한 | `MEMBER` |
| 테스트용 이메일 | `manager@mabiz.test` |
| 조직 | `Test Organization` |
| 접근 가능 경로 | `/dashboard/*`, `/dashboard/team/*`, `/contacts/*` |

**책임**:
- 자신의 팀 정보 조회 (팀 내 판매원만)
- 배치(batch) 생성 및 관리
- 판매원 실적 모니터링
- CruiseDot 상품 조회 (배정된 것만)

---

### 3️⃣ Sales (판매원)
**역할**: 고객 관리 및 판매 활동

| 속성 | 값 |
|------|-----|
| 계정타입 | `OrganizationMember` |
| 역할 | `AGENT` |
| 권한 | `MEMBER` |
| 테스트용 이메일 | `sales@mabiz.test` |
| 조직 | `Test Organization` |
| 접근 가능 경로 | `/dashboard/*`, `/contacts/*`, `/campaigns/*` |

**책임**:
- 개인 콜 기록 관리
- 할당된 고객 정보 조회/수정
- CRM 상태 업데이트 (status, stage, tags)
- SMS/이메일 발송 (조직 범위)

---

### 4️⃣ Pre-Sales (사전판매/상담)
**역할**: 초기 리드 관리 및 상담 기록

| 속성 | 값 |
|------|-----|
| 계정타입 | `OrganizationMember` |
| 역할 | `PRESALES` (또는 `AGENT`) |
| 권한 | `MEMBER` |
| 테스트용 이메일 | `presales@mabiz.test` |
| 조직 | `Test Organization` |
| 접근 가능 경로 | `/contacts/*`, `/campaigns/*`, `/messages/*` |

**책임**:
- 인바운드 문의(Lead) 조회
- 초기 상담 기록(anxiety assessment, L2 렌즈)
- Follow-up 스케줄 생성
- 예약 정보 기록

---

## 🧪 테스트 항목별 체크리스트

### Phase 1: 인증 시스템 (Authentication)

#### 1.1 Clerk OAuth 로그인
```
□ Clerk 로그인 페이지 정상 로딩
□ 테스트 이메일로 로그인 성공
□ MabizSession 생성 확인 (Neon DB)
□ 로그인 후 /dashboard로 리다이렉트
□ 세션 쿠키 'mabiz.sid' 설정 확인
□ 세션 만료 시간 설정 (기본: 30일)
```

**테스트 스크립트**:
```bash
# 1. 로그인 페이지 접속
curl -i "https://localhost:3000/sign-in"

# 2. Clerk 인증 후 리다이렉트 URI 확인
# Expected: /dashboard (또는 사용자의 마지막 페이지)

# 3. 세션 확인
curl -H "Cookie: mabiz.sid=<SESSION_ID>" \
  "https://localhost:3000/api/auth/session"
```

---

#### 1.2 로그인 후 역할 로딩
```
□ getMabizSession() 호출 시 role 값 반환
□ organizationId 값 정확함
□ displayName 값 정확함
□ 역할별 권한 레벨 설정 확인
```

**테스트 코드**:
```typescript
// src/tests/auth-roles.test.ts
import { getMabizSession } from '@/lib/auth';

describe('Auth: Role Loading', () => {
  test('GLOBAL_ADMIN should have GLOBAL_ADMIN role', async () => {
    const session = await getMabizSession('admin-session-id');
    expect(session?.role).toBe('GLOBAL_ADMIN');
  });

  test('MEMBER should have MEMBER role', async () => {
    const session = await getMabizSession('member-session-id');
    expect(session?.role).toBe('MEMBER');
  });
});
```

---

### Phase 2: 권한 검증 (Authorization / RBAC)

#### 2.1 관리자 경로 접근
```
□ /admin/* 경로에 관리자만 접근 가능
□ /contracts/* 경로에 관리자만 접근 가능
□ 비관리자 접근 시 /403-forbidden 리다이렉트
```

**테스트 케이스**:
| 경로 | Admin | Member | 결과 |
|------|-------|--------|------|
| `/admin/users` | ✅ | ❌ | 403 |
| `/contracts/templates` | ✅ | ❌ | 403 |
| `/dashboard/dashboard` | ✅ | ✅ | 200 |

**테스트 스크립트**:
```bash
# Admin 접근
curl -H "Cookie: mabiz.sid=<ADMIN_SESSION>" \
  "https://localhost:3000/admin/users"
# Expected: 200 OK

# Member 접근 (실패)
curl -H "Cookie: mabiz.sid=<MEMBER_SESSION>" \
  "https://localhost:3000/admin/users"
# Expected: 403 Forbidden → /403-forbidden 리다이렉트
```

---

#### 2.2 팀 관리 권한
```
□ /dashboard/team/* 경로는 OWNER 또는 AGENT만 접근
□ 자신의 팀 정보만 조회 가능 (organizationId 일치)
□ 다른 조직의 팀 정보는 접근 불가
```

**테스트 코드**:
```typescript
// src/tests/rbac-team.test.ts
import { checkPathAccess, hasRequiredRole } from '@/lib/route-rules';

describe('RBAC: Team Management', () => {
  test('MEMBER can access /dashboard/team/members', () => {
    const allowed = checkPathAccess('/dashboard/team/members', 'MEMBER');
    expect(allowed).toBe(true);
  });

  test('UNKNOWN cannot access /dashboard/team/*', () => {
    const allowed = checkPathAccess('/dashboard/team/members', 'UNKNOWN');
    expect(allowed).toBe(false);
  });
});
```

---

#### 2.3 고객 정보 접근 제어
```
□ 판매원은 자신에게 할당된 고객만 수정 가능
□ 매니저는 팀 내 모든 고객 조회 가능
□ 관리자는 조직 내 모든 고객 조회 가능
□ Contact.assignedUserId 필드로 권한 확인
```

**테스트 케이스**:
```
User: sales@mabiz.test (userId: sales-123)
Contact: {"id": "cust-001", "assignedUserId": "sales-123", ...}

Case 1: 본인 고객 수정
  PATCH /api/contacts/cust-001
  Body: {"stage": "booking"}
  Expected: 200 OK

Case 2: 타인 고객 수정
  User: sales2@mabiz.test (userId: sales-456)
  PATCH /api/contacts/cust-001
  Body: {"stage": "booking"}
  Expected: 403 Forbidden (또는 자동 스킵)
```

---

### Phase 3: CRM 기능 검증 (Feature Access)

#### 3.1 Contact 관리 API
```
□ GET /api/contacts (목록 조회)
  - MEMBER: organizationId 필터링된 목록
  - Admin: 전체 조직 고객
  
□ POST /api/contacts (신규 생성)
  - 조직 ID 자동 할당
  - 생성자 userId 기록
  
□ PATCH /api/contacts/:id (수정)
  - assignedUserId 확인
  - 권한 없으면 403
  
□ DELETE /api/contacts/:id (삭제)
  - Soft delete (deletedAt 설정)
  - Admin만 가능 (또는 owner)
```

**테스트 스크립트**:
```bash
# 1. Contact 목록 조회
curl -H "Authorization: Bearer <TOKEN>" \
  "https://localhost:3000/api/contacts"
# Expected: 200 + organizationId 필터링된 목록

# 2. Contact 생성
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "01012345678",
    "name": "테스트 고객",
    "email": "test@example.com"
  }' \
  "https://localhost:3000/api/contacts"
# Expected: 201 Created

# 3. Contact 수정 (L0 렌즈: reactivationSegment)
curl -X PATCH \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "reactivationSegment": "3-6m",
    "reactivationLikelihood": 75
  }' \
  "https://localhost:3000/api/contacts/cust-001"
# Expected: 200 OK
```

---

#### 3.2 고객 분류 및 렌즈 적용
```
□ L0 Lens (부재중 고객)
  - reactivationSegment: "3-6m" | "6-12m" | "1y+"
  - reactivationLikelihood: 0-100
  - smsDay0Sent, smsDay1Sent, ... 추적
  
□ L1 Lens (가격이의)
  - priceObjectionFlag: boolean
  - l1ABTestVariant: 선택된 A/B 변형
  
□ L2 Lens (준비불안)
  - anxietyScore: 0-100
  - anxietyCategory: "low" | "medium" | "high"
  - preparationStage: "inquiry" | "visa_concern" | ...
  - healthConcerns: ["배멀미", "당뇨", "고혈압", ...]
  
□ L3 Lens (차별성)
  - competitorMentioned: boolean
  - competitorNames: ["Royal", "MSC", ...]
  - differentiationScore: 0-100
  
□ L5, L6, L7, ... 렌즈
  - familyComposition, decisionMaker (L7)
  - autoSegment, segmentOverride (자동분류)
```

**테스트 케이스**:
```typescript
// src/tests/crm-lens-classification.test.ts
describe('CRM: Lens Classification', () => {
  test('L0 Reactivation: Contact inactive 6-12 months', async () => {
    const contact = await prisma.contact.update({
      where: { id: 'cust-001' },
      data: {
        reactivationSegment: '6-12m',
        reactivationLikelihood: 65,
      }
    });
    
    expect(contact.reactivationSegment).toBe('6-12m');
    expect(contact.reactivationLikelihood).toBe(65);
  });

  test('L2 Anxiety: Contact has high anxiety score', async () => {
    const contact = await prisma.contact.update({
      where: { id: 'cust-002' },
      data: {
        anxietyScore: 85,
        anxietyCategory: 'high',
        preparationStage: 'health_concern',
        healthConcerns: '배멀미, 당뇨',
      }
    });
    
    expect(contact.anxietyScore).toBe(85);
    expect(contact.healthConcerns).toContain('배멀미');
  });

  test('L3 Differentiation: Competitor mention detected', async () => {
    const contact = await prisma.contact.update({
      where: { id: 'cust-003' },
      data: {
        competitorMentioned: true,
        competitorNames: ['Royal Caribbean', 'MSC'],
        differentiationScore: 35,
      }
    });
    
    expect(contact.competitorMentioned).toBe(true);
    expect(contact.differentiationScore).toBe(35);
  });
});
```

---

#### 3.3 SMS 발송 권한
```
□ SMS 발송 권한:
  - OrgSmsConfig 설정 확인 (Aligo key, sender phone)
  - 본인 조직 내 Contact만 발송 가능
  - Day 0-3 자동화 Cron 실행 확인
  
□ SMS 추적:
  - smsDay0Sent, smsDay0SentAt 기록
  - ScheduledSms 테이블 저장
```

---

### Phase 4: CruiseDot API 연동

#### 4.1 상품 조회 API
```
□ CruiseDot 상품 목록 조회
  - API Key 설정 확인
  - 상품 필터링 (배정된 것만)
  
□ 상품 상세 정보
  - 가격 정보
  - 출발지/도착지
  - 일정 정보
```

**환경변수 확인**:
```bash
# .env.local / .env.production에 설정 필요
CRUISEDOT_API_KEY=sk_live_xxxxx
CRUISEDOT_API_URL=https://api.cruisedot.co.kr/v1
CRUISEDOT_WEBHOOK_SECRET=sk_prod_xxxxx
```

**테스트 스크립트**:
```bash
# 1. 상품 목록 조회
curl -H "Authorization: Bearer <TOKEN>" \
  "https://localhost:3000/api/products"
# Expected: 200 + 크루즈 상품 목록

# 2. 상품 예약 생성
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "productId": "cruise-001",
    "contactId": "cust-001",
    "passengers": 2,
    "cabinType": "interior"
  }' \
  "https://localhost:3000/api/bookings"
# Expected: 201 Created + bookingRef
```

---

#### 4.2 Webhook 처리
```
□ CruiseDot Webhook 수신
  - eventType: 'payment.created' | 'payment.updated' | 'payment.refunded'
  - HMAC-SHA256 서명 검증
  - Contact.lastPaymentStatus 업데이트
  
□ 결제 상태 동기화
  - PENDING → CONFIRMED → REFUNDED 추적
  - refundAmount 기록
```

**Webhook 테스트**:
```bash
# 1. Webhook 시뮬레이션 (결제 완료)
curl -X POST \
  -H "Authorization: Bearer sk_prod_xxxxx" \
  -H "x-signature: <HMAC_SHA256_SIGNATURE>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_123",
    "eventType": "payment.confirmed",
    "bookingRef": "BK001",
    "status": "CONFIRMED"
  }' \
  "https://localhost:3000/api/webhooks/cruisedot-payment"
# Expected: 200 OK

# 2. Contact 상태 확인
curl -H "Authorization: Bearer <TOKEN>" \
  "https://localhost:3000/api/contacts/cust-001"
# Expected: lastPaymentStatus = "CONFIRMED"
```

---

### Phase 5: 성능 검증 (Performance)

#### 5.1 페이지 로딩 속도
```
□ Dashboard 로딩: < 2.5초
□ Contacts 목록: < 1.5초
□ Contact 상세: < 1.0초
□ Admin 보고서: < 3.0초
```

**Lighthouse 검증**:
```bash
# Lighthouse CLI 사용
npm install -g lighthouse

lighthouse \
  "https://localhost:3000/dashboard/dashboard" \
  --chrome-flags="--headless" \
  --output=json
# Expected: Performance > 90점
```

---

#### 5.2 데이터베이스 쿼리 성능
```
□ Contact 목록 조회: < 500ms (1000개 레코드)
□ Contact 상세 + 관계데이터: < 300ms
□ 렌즈 분류 쿼리: < 200ms
□ N+1 쿼리 문제 없음 (Prisma select 최적화)
```

**성능 프로파일링**:
```typescript
// src/tests/performance.test.ts
import { performance } from 'perf_hooks';

test('Contact list query should be < 500ms', async () => {
  const start = performance.now();
  const contacts = await prisma.contact.findMany({
    where: { organizationId: 'org-test' },
    take: 100,
  });
  const end = performance.now();
  
  expect(end - start).toBeLessThan(500);
  console.log(`Query time: ${end - start}ms`);
});
```

---

### Phase 6: 데이터 동기화 검증

#### 6.1 Neon DB 상태 확인
```
□ Organizations 테이블: 1개 이상
□ OrganizationMembers 테이블: 4명 이상 (테스트 사용자)
□ GlobalAdmin 테이블: 1명 이상 (관리자)
□ MabizSession 테이블: 데이터 정상
□ Contact 테이블: 테스트 고객 100명 이상
```

**SQL 확인 쿼리**:
```sql
-- 1. 테스트 조직 확인
SELECT id, name, slug, plan, status 
FROM "Organization" 
WHERE slug = 'test-organization' 
LIMIT 1;

-- 2. 조직 멤버 확인
SELECT om.id, om.userId, om.role, om.displayName, om.email
FROM "OrganizationMember" om
WHERE om.organizationId = '<ORG_ID>'
ORDER BY om.role DESC;

-- 3. 전역 관리자 확인
SELECT id, displayName, phone, userId
FROM "GlobalAdmin"
LIMIT 5;

-- 4. 세션 유효성 확인
SELECT id, role, memberId, adminId, expiresAt, createdAt
FROM "MabizSession"
WHERE expiresAt > NOW()
LIMIT 10;

-- 5. Contact 렌즈 데이터 확인 (L0-L3)
SELECT 
  id, 
  name, 
  reactivationSegment, 
  anxietyScore, 
  competitorMentioned, 
  differentiationScore
FROM "Contact"
WHERE organizationId = '<ORG_ID>'
LIMIT 10;
```

---

#### 6.2 데이터 일관성 검증
```
□ Contact.organizationId ≠ NULL (모든 고객)
□ Contact.assignedUserId → OrganizationMember.userId (외래키)
□ MabizSession.organizationId → Organization.id (외래키)
□ OrganizationMember.organizationId → Organization.id (외래키)
```

**데이터 무결성 테스트**:
```typescript
// src/tests/data-integrity.test.ts
describe('Data Integrity', () => {
  test('All Contacts must have organizationId', async () => {
    const orphanedContacts = await prisma.contact.findMany({
      where: { organizationId: null }
    });
    expect(orphanedContacts).toHaveLength(0);
  });

  test('All Sessions must have valid expiresAt', async () => {
    const expiredSessions = await prisma.mabizSession.findMany({
      where: { expiresAt: { lt: new Date() } }
    });
    console.log(`Expired sessions: ${expiredSessions.length}`);
  });

  test('assignedUserId must reference valid OrganizationMember', async () => {
    const contacts = await prisma.contact.findMany({
      where: { assignedUserId: { not: null } },
      include: { _count: true }
    });
    
    for (const contact of contacts) {
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: contact.organizationId,
            userId: contact.assignedUserId!
          }
        }
      });
      expect(member).toBeDefined();
    }
  });
});
```

---

## 📊 테스트 실행 계획

### Stage 1: 환경 준비 (30분)
```bash
# 1. 테스트 사용자 생성
npm run script:create-test-users

# 2. 테스트 데이터 세딩
npm run db:seed

# 3. Neon DB 연결 확인
npm run db:health-check

# 4. 환경변수 확인
cat .env.local | grep -E "CLERK|CRUISEDOT|DATABASE"
```

### Stage 2: 자동화 테스트 (60분)
```bash
# 1. 유닛 테스트 (auth, RBAC)
npm test -- src/tests/auth-roles.test.ts
npm test -- src/tests/rbac-team.test.ts
npm test -- src/lib/route-rules.test.ts

# 2. API 통합 테스트
npm test -- src/tests/api/contacts.test.ts
npm test -- src/tests/api/webhooks.test.ts

# 3. 성능 테스트
npm test -- src/tests/performance.test.ts

# 4. 데이터 무결성 테스트
npm test -- src/tests/data-integrity.test.ts
```

### Stage 3: 수동 E2E 테스트 (90분)
```bash
# 1. 개발 서버 시작
npm run dev

# 2. Cypress E2E 테스트 실행
npm run cypress:open

# 3. 각 사용자로 로그인 및 기능 테스트
# - Admin: /admin/users, /contracts/templates
# - Manager: /dashboard/team/members, /contacts
# - Sales: /dashboard/dashboard, /campaigns
# - PreSales: /contacts/inbound, /messages

# 4. 성능 모니터링
# DevTools → Performance → 녹화 → 분석
```

### Stage 4: 결과 정리 및 리포팅 (30분)
```bash
# 테스트 결과 수집
npm test -- --coverage > coverage/test-results.json

# 성능 리포트 생성
lighthouse https://localhost:3000/dashboard \
  --output=json > reports/lighthouse.json

# 최종 체크리스트 작성
# CRM_CONNECTION_TEST_RESULTS.md 생성
```

---

## 🎯 성공 기준

### 필수 기준 (PASS/FAIL)
- [ ] 모든 사용자 역할(4가지) 로그인 성공
- [ ] 권한 기반 접근 제어(RBAC) 정상 작동
- [ ] CRM Contact CRUD API 100% 동작
- [ ] CruiseDot Webhook 수신 및 처리 정상
- [ ] Neon DB 데이터 일관성 문제 없음
- [ ] 페이지 로딩 속도 3초 이내

### 권장 기준 (Quality)
- [ ] Lighthouse 성능 점수 > 85점
- [ ] API 응답 시간 < 200ms
- [ ] 데이터베이스 쿼리 N+1 문제 없음
- [ ] 에러 로그 0건 (경고 제외)
- [ ] 코드 커버리지 > 70%

---

## 📝 테스트 결과 기록 양식

### 테스트 케이스 기록
```
[테스트 ID] TC-001
[제목] Admin 로그인 및 /admin/users 접근
[상태] ✅ PASS / ❌ FAIL / ⏭️ SKIP
[날짜] 2026-05-25 14:00
[소요시간] 2분 30초
[증거] 스크린샷, 콘솔 로그, 응답값
[이슈] (실패 시) 구체적 오류 메시지
[해결] (있으면) 수정 방법 또는 추적 이슈
```

### 종합 리포트
```
테스트 총수: 50개
- PASS: 48개 (96%)
- FAIL: 2개 (4%)
- SKIP: 0개 (0%)

실패 항목:
1. [TC-035] Contact 대량 조회 성능 (2.5초 > 기준 2.0초)
   - Issue: #123 등록함
   - Plan: Prisma query 최적화 (인덱스 추가)
   
2. [TC-042] CruiseDot Webhook 서명 검증
   - Issue: HMAC 계산 로직 오류
   - Fix: 환경변수 'CRUISEDOT_WEBHOOK_SECRET' 재확인

다음 단계:
- [ ] 위 2가지 이슈 해결
- [ ] Stage 2 재테스트
- [ ] 프로덕션 배포 승인
```

---

## 🛠️ 문제 해결 가이드

### 문제 1: "Clerk 로그인 실패 - Invalid credentials"
**원인**: Clerk API Key 또는 publishable key 미설정

**해결**:
```bash
# 1. Clerk 대시보드에서 키 확인
# https://dashboard.clerk.com → API Keys

# 2. .env.local 설정
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# 3. 서버 재시작
npm run dev

# 4. 다시 로그인 시도
```

---

### 문제 2: "권한 오류 - FORBIDDEN: Insufficient permissions"
**원인**: 사용자 역할이 올바르게 설정되지 않음

**진단**:
```sql
-- 사용자 역할 확인
SELECT om.userId, om.role, om.organizationId, o.name
FROM "OrganizationMember" om
JOIN "Organization" o ON om.organizationId = o.id
WHERE om.email = 'user@test.com';

-- 세션 역할 확인
SELECT role, expiresAt, memberId
FROM "MabizSession"
WHERE id = '<SESSION_ID>';
```

**해결**:
```sql
-- 역할 업데이트
UPDATE "OrganizationMember"
SET role = 'AGENT'
WHERE email = 'user@test.com' AND organizationId = '<ORG_ID>';
```

---

### 문제 3: "CruiseDot API 연결 실패 - 401 Unauthorized"
**원인**: CruiseDot API Key 또는 Secret 잘못됨

**진단**:
```bash
# 1. API Key 형식 확인
echo $CRUISEDOT_API_KEY

# 2. 직접 API 호출 테스트
curl -H "Authorization: Bearer $CRUISEDOT_API_KEY" \
  "https://api.cruisedot.co.kr/v1/products"
```

**해결**:
```bash
# 1. Cruisedot 관리자에게 올바른 키 요청
# 2. .env.local 업데이트
CRUISEDOT_API_KEY=sk_live_xxxxx  # staging → production 변경
CRUISEDOT_WEBHOOK_SECRET=sk_prod_xxxxx

# 3. Webhook Secret도 함께 확인
# https://dashboard.cruisedot.co.kr → Webhooks → Secret
```

---

### 문제 4: "Contact 조회 시 N+1 쿼리 문제"
**원인**: 렌즈 정보나 관계 데이터를 loop에서 조회

**진단**:
```bash
# 쿼리 로그 확인 (Prisma Query Engine)
DATABASE_URL="..." DEBUG=* npm run dev
```

**해결**:
```typescript
// 기존 (N+1)
const contacts = await prisma.contact.findMany({
  where: { organizationId: orgId }
});
// contacts.map()에서 각각 렌즈 정보 조회 → N+1

// 개선 (한 번의 쿼리)
const contacts = await prisma.contact.findMany({
  where: { organizationId: orgId },
  select: {
    id: true,
    name: true,
    email: true,
    reactivationSegment: true,
    anxietyScore: true,
    competitorMentioned: true,
    // 렌즈 필드 미리 로드
  }
});
```

---

## 📞 연락처 및 지원

**테스트 진행 중 문제 발생 시**:
- Slack: #qa-crm-testing
- Email: qa@mabiz.com
- GitHub Issues: [CRM Connection Test Issues](https://github.com/mabiz/crm/issues?label=test)

**주요 담당자**:
| 역할 | 이름 | 연락처 |
|------|------|--------|
| 테스트 리더 | 김테스터 | kim@mabiz.com |
| 개발 지원 | 이개발자 | lee@mabiz.com |
| DB 관리 | 박데이터 | park@mabiz.com |

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0 (초안)  
**상태**: 🔄 검토 대기 중

