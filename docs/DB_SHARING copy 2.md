# mabiz-CRM ↔ 크루즈닷몰 DB 공유 명세서

> **작성일**: 2026-05-07 | **최종 업데이트**: 2026-05-07 (소셜 로그인 필드 추가)
> **대상**: 크루즈닷몰(GMcruise) 개발팀  
> **목적**: 두 시스템이 동일한 Neon PostgreSQL DB를 공유하므로, CRM이 어떤 테이블을 어떻게 사용하는지 정확히 공유합니다.

---

## 1. 연결 설정

두 프로젝트가 **완전히 동일한 DATABASE_URL**을 사용합니다.

```env
# 크루즈닷몰 (.env)
DATABASE_URL="postgresql://..."

# mabiz-CRM (.env.mabiz)   ← 동일한 값 복사
DATABASE_URL="postgresql://..."   # ← 크루즈닷몰과 완전 동일
```

CRM은 별도 DB를 생성하지 않습니다. 크루즈닷몰 DB에 CRM 전용 테이블만 추가합니다.

---

## 2. CRM이 읽는 크루즈닷몰 테이블

CRM은 아래 테이블을 **읽기 전용**으로 참조합니다. 이 테이블은 크루즈닷몰이 소유·관리합니다.

### 2-1. `User` (로그인 / 본인 확인)

```sql
-- CRM 로그인 시 조회
SELECT u.id, u.name, u.password, u.role, u."mallUserId",
       ap.type AS "affiliateType"
FROM "User" u
LEFT JOIN "AffiliateProfile" ap ON ap."userId" = u.id AND ap.status = 'ACTIVE'
WHERE (u."mallUserId" = $1 OR u.phone = $1)
  AND u."isLocked" = false
LIMIT 1;
```

**CRM이 의존하는 컬럼** (삭제·rename 금지):

| 컬럼 | 용도 |
|------|------|
| `id` | GMcruise 유저 PK, 세션에 저장 |
| `name` | 로그인 후 이름 표시 |
| `password` | bcrypt 해시 비교 (소셜 로그인 유저도 랜덤 pw 저장) |
| `role` | `'admin'` 이면 CRM GLOBAL_ADMIN |
| `mallUserId` | 로그인 ID (일반: 전화번호, 소셜: `naver_{id}` / `kakao_{id}` / `google_{id}`) |
| `isLocked` | 잠긴 계정 로그인 차단 |
| `mallNickname` | 커뮤니티 닉네임 (소셜 가입 시 자동 설정) |
| `customerSource` | 유입 경로 — `'naver-oauth'` / `'kakao-oauth'` / `'google-oauth'` / 기타 |
| `onboarded` | 최초 온보딩 완료 여부 (소셜 신규가입 시 `false`) |
| `socialProvider` | 소셜 제공자 — `'naver'` / `'kakao'` / `'google'` / `null` |
| `socialId` | 소셜 제공자 고유 ID |
| `socialEmail` | 소셜에서 받은 이메일 |
| `socialProfileImg` | 소셜 프로필 이미지 URL |

---

### 2-2. `AffiliateProfile` (파트너 프로필)

```sql
SELECT ap.id, ap."affiliateCode", ap.type, ap.status,
       ap."displayName", ap."userId"
FROM "AffiliateProfile" ap
WHERE ap."userId" = $1 AND ap.status = 'ACTIVE'
LIMIT 1;
```

**CRM이 의존하는 컬럼**:

| 컬럼 | 용도 |
|------|------|
| `id` | OWNER/AGENT 스코프 필터링 기준 |
| `type` | CRM 역할 결정 (아래 역할 매핑 참조) |
| `status` | `'ACTIVE'` 인 프로필만 인식 |
| `displayName` | 파트너 이름 표시 |
| `affiliateCode` | FREE_SALES 대시보드 표시 |
| `userId` | User.id 연결 |

---

### 2-3. `AffiliateRelation` (OWNER ↔ AGENT 팀 관계)

```sql
-- OWNER의 팀원 범위 조회 (모든 OWNER 스코프 쿼리에 사용)
SELECT ar."agentId"
FROM "AffiliateRelation" ar
WHERE ar."managerId" = $1   -- OWNER의 profileId
  AND ar.status = 'ACTIVE';
```

**CRM이 의존하는 컬럼**:

| 컬럼 | 용도 |
|------|------|
| `managerId` | OWNER profileId |
| `agentId` | OWNER 소속 AGENT profileId |
| `status` | `'ACTIVE'` 만 인식 |

---

### 2-4. `AffiliateSale` (판매 이력) — **읽기 + 쓰기**

CRM은 이 테이블을 **조회하고 상태를 변경**합니다 (승인/반려/환불).

```sql
-- CRM이 쓰는 컬럼 (UPDATE)
UPDATE "AffiliateSale"
SET  status       = 'APPROVED',
     "approvedAt" = NOW(),
     "approvedById" = $userId,
     "confirmedAt" = NOW()
WHERE id = $id;

-- 반려
SET  status          = 'REJECTED',
     "rejectedAt"    = NOW(),
     "rejectedById"  = $userId,
     "rejectionReason" = $reason;

-- 환불
SET  status       = 'REFUNDED',
     "refundedAt" = NOW();
```

**CRM이 의존하는 컬럼** (삭제·rename 금지):

| 컬럼 | 읽기/쓰기 | 용도 |
|------|-----------|------|
| `id` | 읽기 | PK |
| `agentId` | 읽기 | AGENT 스코프 필터 |
| `managerId` | 읽기+쓰기 | OWNER 스코프 필터 |
| `saleAmount` | 읽기 | 매출 집계 |
| `salesCommission` | 읽기 | 커미션 표시 |
| `status` | 읽기+쓰기 | PENDING / PENDING_APPROVAL / APPROVED / REJECTED / REFUNDED |
| `saleDate` | 읽기 | 월별 필터 (`TO_CHAR("saleDate",'YYYY-MM')`) |
| `confirmedAt` | 읽기+쓰기 | 승인 시각 |
| `approvedAt` | 쓰기 | 승인자 기록 |
| `approvedById` | 쓰기 | 승인자 User.id |
| `rejectedAt` | 쓰기 | 반려 시각 |
| `rejectedById` | 쓰기 | 반려자 User.id |
| `rejectionReason` | 쓰기 | 반려 사유 |
| `refundedAt` | 쓰기 | 환불 시각 |
| `externalOrderCode` | 읽기 | 주문번호 표시 |
| `productCode` | 읽기 | 상품코드 표시 |
| `headcount` | 읽기 | 인원 표시 |
| `submittedById` | 읽기 | 제출자 |
| `submittedAt` | 읽기 | 제출 시각 |
| `cancellationReason` | 읽기 | 취소 사유 |

> ⚠️ **`yearMonth` 컬럼은 AffiliateSale에 존재하지 않습니다.**  
> CRM은 `TO_CHAR("saleDate", 'YYYY-MM')` 으로 월 필터를 처리합니다.

---

### 2-5. `CommissionLedger` (커미션 원장) — 읽기 전용

```sql
SELECT cl.id, cl."profileId", cl."saleId", cl."entryType",
       cl.amount, cl."withholdingAmount", cl."isSettled", cl.notes, cl."createdAt"
FROM "CommissionLedger" cl
WHERE cl."profileId" = $profileId   -- 또는 OWNER 팀 조건
ORDER BY cl."createdAt" DESC;
```

**CRM이 의존하는 컬럼**:

| 컬럼 | 용도 |
|------|------|
| `id` | PK |
| `profileId` | AffiliateProfile.id (필터 기준) |
| `saleId` | 연결된 판매건 |
| `entryType` | `SALES_COMMISSION` / `OVERRIDE_COMMISSION` / `BRANCH_COMMISSION` / `HQ_NET` / `WITHHOLDING` |
| `amount` | 커미션 금액 |
| `withholdingAmount` | 원천징수액 |
| `isSettled` | 정산 여부 |
| `notes` | 메모 |
| `createdAt` | 월별 범위 필터 기준 |

> ⚠️ `balance`, `yearMonth`, `type` 컬럼은 없습니다. CRM이 의존하지 않습니다.

---

### 2-6. `AffiliatePayslip` (급여명세) — 읽기 전용

```sql
SELECT p.id, p."profileId", p.period, p."totalCommission",
       p."totalWithholding", p."netPayment", p.status, p."sentAt",
       COALESCE(ap."displayName", u.name) AS "agentDisplayName",
       u."mallUserId" AS "agentMallUserId"
FROM "AffiliatePayslip" p
JOIN "AffiliateProfile" ap ON ap.id = p."profileId"
JOIN "User" u ON u.id = ap."userId"
WHERE ...;
```

**CRM이 의존하는 컬럼**:

| 컬럼 | 용도 |
|------|------|
| `id` | PK |
| `profileId` | 대상 파트너 |
| `period` | `'YYYY-MM'` 형식 월 |
| `totalCommission` | 총 커미션 |
| `totalWithholding` | 원천징수 |
| `netPayment` | 실수령액 |
| `status` | `PENDING` / `APPROVED` / `SENT` |
| `sentAt` | 지급 완료 시각 |

---

### 2-7. `ProductInquiry` (골드문의 / 골드회원) — **읽기 + 상태 변경**

```sql
-- 골드문의 목록 (productCode='GOLD_MEMBERSHIP')
SELECT pi.id, pi.name, pi.phone, pi.message, pi.status, pi."createdAt"
FROM "ProductInquiry" pi
WHERE pi."productCode" = 'GOLD_MEMBERSHIP'
ORDER BY pi."createdAt" DESC;

-- 상태 변경 (PATCH)
UPDATE "ProductInquiry"
SET status = $status, "updatedAt" = NOW()
WHERE id = $id AND "productCode" = 'GOLD_MEMBERSHIP';
```

**CRM이 의존하는 컬럼**:

| 컬럼 | 용도 |
|------|------|
| `id` | PK |
| `productCode` | `'GOLD_MEMBERSHIP'` 필터 |
| `name` | 신청자 이름 |
| `phone` | 마스킹 처리 후 표시 |
| `message` | 신청 메시지 |
| `status` | `pending` / `passport_waiting` / `confirmed` / `unavailable` / `refund` |
| `createdAt` | 접수일 |
| `updatedAt` | 상태 변경 시 업데이트 |

> ⚠️ `tier`, `submittedAt`, `agentId`, `managerId` 컬럼은 `ProductInquiry`에 없습니다.

---

### CRM 골드회원 판별 쿼리 (2026-05-07 추가)

CRM settings/members 페이지에서 팀원 중 골드회원 여부를 실시간으로 표시하기 위해
ProductInquiry LEFT JOIN 방식을 사용합니다.

```sql
-- GET /api/org/members — raw SQL (Prisma findMany 대신)
SELECT
  u.id,
  u.name,
  u."mallUserId",
  ap.type AS "affiliateType",
  ap.status AS "affiliateStatus",
  pi."phone" IS NOT NULL AS "isGoldMember",
  pi."createdAt"::text AS "goldMemberSince"
FROM "User" u
LEFT JOIN "AffiliateProfile" ap ON ap."userId" = u.id
LEFT JOIN "ProductInquiry" pi
  ON pi.phone = u.phone
  AND pi."productCode" = 'GOLD_MEMBERSHIP'
  AND pi.status = 'confirmed'
WHERE u.id IN (/* 팀원 userId 목록 */)
ORDER BY u.name;
```

CRM UI: `settings/members/page.tsx`에서 Member 타입에 `isGoldMember: boolean`, `goldMemberSince: string | null` 필드 추가.
역할 배지 옆에 골드회원 ★ 배지(노란색) + 가입일 [10px] 텍스트 표시.
한 계정이 파트너(AGENT/OWNER) + 골드회원 두 신분을 동시에 가질 수 있음.

---

## 2-8. 소셜 로그인 유저 구분 방법 (2026-05-07 추가)

카카오 / 네이버 / 구글 OAuth 가입 시 `User` 레코드 생성 규칙:

```sql
-- 소셜 로그인 유저 조회
SELECT id, name, "mallUserId", "mallNickname", "socialProvider",
       "socialId", "socialEmail", "socialProfileImg",
       "customerSource", onboarded
FROM "User"
WHERE "socialProvider" IN ('naver','kakao','google');
```

| 제공자 | `mallUserId` 패턴 | `customerSource` | 비밀번호 |
|--------|-------------------|------------------|---------|
| 네이버 | `naver_{naverId}` | `naver-oauth` | 랜덤 bcrypt (사용자 모름) |
| 카카오 | `kakao_{kakaoId}` | `kakao-oauth` | 랜덤 bcrypt (사용자 모름) |
| 구글 | `google_{googleId}` | `google-oauth` | 랜덤 bcrypt (사용자 모름) |

> ⚠️ 소셜 로그인 유저는 CRM에서 일반 로그인(mallUserId + password)이 불가합니다.  
> CRM 로그인 화면에서 소셜 유저 접근을 막거나 별도 안내가 필요합니다.

### 이메일 자동 연동 규칙
동일 이메일로 기존 일반 가입 계정이 있으면 소셜 정보를 자동 연동합니다:
```sql
-- 소셜 연동 시 업데이트되는 컬럼
UPDATE "User"
SET "socialProvider" = $provider,
    "socialId"       = $socialId,
    "socialEmail"    = $socialEmail,
    "socialProfileImg" = $profileImg
WHERE email = $socialEmail;
```

---

## 3. 필수 시드 데이터 (크루즈닷몰 팀이 생성해야 함)

골드문의·골드회원 기능이 동작하려면 `CruiseProduct` 테이블에 아래 레코드가 있어야 합니다. (`ProductInquiry`가 `CruiseProduct.productCode`에 FK 제약이 있으므로 반드시 먼저 존재해야 합니다.)

```sql
INSERT INTO "CruiseProduct" (
  "productCode",
  "cruiseLine",
  "shipName",
  "packageName",
  "nights",
  "days",
  "itineraryPattern",
  "isPopular"
)
VALUES (
  'GOLD_MEMBERSHIP',
  '크루즈닷',
  '-',
  '골드회원권',
  0,
  0,
  '[]',
  false
)
ON CONFLICT ("productCode") DO NOTHING;
```

이 레코드 없이는 골드문의 신청 시 FK 오류가 발생합니다.

---

## 4. 역할 매핑 규칙

크루즈닷몰 `User.role` + `AffiliateProfile.type` → CRM 역할 변환:

| 크루즈닷몰 조건 | CRM 역할 | 접근 범위 |
|----------------|----------|-----------|
| `User.role = 'admin'` | `GLOBAL_ADMIN` | 전체 |
| `AffiliateProfile.type = 'BRANCH_MANAGER'` | `OWNER` | 소속 팀 |
| `AffiliateProfile.type = 'HQ'` | `OWNER` | 소속 팀 |
| `AffiliateProfile.type = 'PRESALES'` | `FREE_SALES` | 본인 affiliateCode만 |
| `AffiliateProfile.type = 'SALES_AGENT'` | `AGENT` | 본인 판매건만 |
| 위 조건 해당 없음 | 로그인 불가 | — |

---

## 5. CRM 전용 테이블 (크루즈닷몰이 건드리지 말 것)

아래 테이블은 CRM이 `prisma migrate`로 생성·관리하며, 크루즈닷몰과 무관합니다.

| 테이블명 | 설명 |
|---------|------|
| `GlobalAdmin` | CRM 전용 최고관리자 계정 |
| `MabizSession` | CRM 세션 (쿠키 기반 인증) |
| `Organization` | CRM 조직(대리점) 단위 |
| `OrganizationMember` | CRM 조직 멤버 (별도 계정) |
| `Contact` | CRM 고객 DB |
| `ContactGroup` / `ContactGroupMember` | 고객 그룹 |
| `CallLog` / `ContactMemo` | 콜·메모 기록 |
| `CrmLandingPage` / `CrmLandingRegistration` | CRM 랜딩 |
| `Funnel` / `FunnelStage` | 자동화 퍼널 |
| `SmsTemplate` / `SmsLog` / `SmsOptOut` | SMS |
| `ScheduledSms` | 예약 발송 |
| `SalesPlaybook` | 영업 플레이북 |
| `SalesDocument` / `SalesDocumentApproval` | 영업 문서 |
| `B2BProspect` | B2B 파이프라인 |
| `AiCallLog` / `AiCallAnalysis` | AI 콜 분석 |
| `ScriptPattern` | 스크립트 패턴 |
| `ShortLink` / `ShortLinkClick` | 숏링크 |
| `MemberDocument` | 판매원 서류 |
| `OrgInviteToken` | 초대 토큰 |
| `PayAppPayment` | 결제 |
| `VipCareSequence` / `VipCareLog` | VIP 케어 |

---

## 6. 공유 테이블 (양쪽이 모두 사용)

| 테이블명 | 소유 | CRM 접근 방식 |
|---------|------|--------------|
| `ImageCache` | 크루즈닷몰 | 읽기 전용 |
| `Payment` | 크루즈닷몰 | 읽기 전용 |
| `SystemConfig` | 공유 | 읽기/쓰기 (configKey 네임스페이스 구분) |

---

## 7. 마이그레이션 순서

처음 CRM을 크루즈닷몰 DB에 연결할 때 순서:

```bash
# 1. CRM 레포에서 (.env.mabiz에 DATABASE_URL 설정 후)
cd mabiz-crm
npx prisma migrate deploy   # CRM 전용 테이블 생성

# 2. 크루즈닷몰 DB에 골드회원권 시드 (위 3번 SQL 실행)

# 3. GlobalAdmin 초기 계정 생성
node scripts/seed-global-admin.js
```

---

## 8. 절대 하지 말 것 (크루즈닷몰 팀 주의)

| 금지 사항 | 이유 |
|-----------|------|
| `AffiliateSale`에서 `agentId`, `managerId`, `saleDate` 컬럼 rename/삭제 | CRM 쿼리 전체 crash |
| `AffiliateProfile`에서 `type`, `status`, `displayName` rename/삭제 | 로그인 + 역할 결정 불가 |
| `AffiliateRelation`에서 `managerId`, `agentId`, `status` rename/삭제 | OWNER 스코프 전체 붕괴 |
| `CommissionLedger`에서 `profileId`, `entryType`, `notes` rename/삭제 | 커미션 원장 crash |
| `AffiliatePayslip`에서 `profileId`, `period`, `netPayment`, `sentAt` rename/삭제 | 급여명세 crash |
| `ProductInquiry`에서 `productCode`, `status`, `updatedAt` rename/삭제 | 골드문의 crash |
| `User`에서 `mallUserId`, `password`, `isLocked`, `role` rename/삭제 | 로그인 불가 |
| `CruiseProduct`에서 `productCode` FK 제약 변경 | 골드문의 INSERT 오류 |
| CRM 전용 테이블(`MabizSession` 등) 임의 삭제 | CRM 세션 전체 파괴 |

---

## 9. 연락처

스키마 변경이 필요할 경우 CRM 팀에 먼저 공유 후 협의:

- **CRM 측 담당**: mabiz-crm 개발팀
- **공유 컬럼 변경 시**: PR 올리기 전 반드시 양쪽 팀 리뷰

---

_이 문서는 코드 변경 시 자동으로 업데이트되지 않습니다. 스키마 변경 시 함께 수정해주세요._
