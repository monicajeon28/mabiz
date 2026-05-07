# 크루즈닷 DB 연동 명세서 (mabiz-crm 전용)

> **작성일**: 2026-05-07  
> **DB**: Neon PostgreSQL (크루즈닷 프로덕션)  
> **대상**: mabiz-crm 개발팀 — 판매원 · 대리점장 · 프리세일즈 · 고객 관리 전용  
> **주의**: 이 문서는 크루즈닷 앱(`GMcruise`)의 실제 DB 스키마 기준. 오직 READ/조회 또는 명시된 필드만 수정할 것.

---

## 1. 핵심 관계 구조 (Entity Relationship 요약)

```
User ──────────────────────────────────┐
  │ 1:1                                │
  ▼                                    │
AffiliateProfile ◄──── AffiliateRelation (매니저↔에이전트)
  │           │
  │           └──────► AffiliateLink (공유링크)
  │                         │
  │                         ▼
  └──────────────────► AffiliateLead (고객 리드)
                            │
                            ▼
                       AffiliateSale (판매 실적)
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
           CommissionLedger      Payment
                  │
                  ▼
           AffiliatePayslip (지급명세서)
           Settlement / MonthlySettlement

User ──► GoldMember (골드회원)
User ──► Reservation ──► Trip (예약·여행 일정)
```

---

## 2. 판매원 타입 구분 (CRITICAL)

### 2.1 타입 판별 규칙

| 구분 | `AffiliateProfile.type` | `User.mallUserId` 패턴 | 설명 |
|------|------------------------|----------------------|------|
| **프리세일즈** | `'SALES_AGENT'` | `pre*` 로 시작 | 대리점장이 초대한 판매원 |
| **세일즈** | `'SALES_AGENT'` | `sales*` 로 시작 | 어드민 직접 등록 판매원 |
| **대리점장** | `'BRANCH_MANAGER'` | 무관 | 팀 관리 권한 보유 |
| **본사** | `'HQ'` | 무관 | 어드민 직접 생성 |

> **주의**: `type` 단독으로는 프리세일즈 판별 불가. 반드시 `type === 'SALES_AGENT' AND mallUserId ILIKE 'pre%'` 두 조건 AND 사용.

### 2.2 SQL 예시

```sql
-- 프리세일즈 전체 조회
SELECT ap.*, u.name, u."mallUserId"
FROM "AffiliateProfile" ap
JOIN "User" u ON u.id = ap."userId"
WHERE ap.type = 'SALES_AGENT'
  AND u."mallUserId" ILIKE 'pre%';

-- 대리점장 전체 조회
SELECT ap.*, u.name, u.phone
FROM "AffiliateProfile" ap
JOIN "User" u ON u.id = ap."userId"
WHERE ap.type = 'BRANCH_MANAGER';

-- 세일즈(일반) 전체 조회
SELECT ap.*, u.name, u.phone
FROM "AffiliateProfile" ap
JOIN "User" u ON u.id = ap."userId"
WHERE ap.type = 'SALES_AGENT'
  AND (u."mallUserId" NOT ILIKE 'pre%' OR u."mallUserId" IS NULL);
```

---

## 3. 테이블 상세 명세

### 3.1 User

> 모든 로그인 사용자의 루트 테이블. 판매원/고객/어드민 모두 포함.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `name` | String | Yes | - | 실명 |
| `email` | String | Yes | - | 이메일 (unique) |
| `phone` | String | Yes | - | 전화번호 (`010XXXXXXXX` 형식) |
| `role` | String | No | `'user'` | `'user'` / `'admin'` |
| `grade` | String | No | `'regular'` | `'regular'` / `'gold'` / `'presales'` |
| `mallUserId` | String | Yes | - | 몰 파트너 ID (`pre*`, `sales*` 등) |
| `mallNickname` | String | Yes | - | 몰 닉네임 |
| `goldMemberId` | Int | Yes | - | GoldMember FK (unique, 골드회원이면 존재) |
| `affiliateCode` | String | Yes | - | 4자리 초대 코드 (unique) |
| `password` | String | No | - | bcrypt 해시 또는 평문 레거시 |
| `customerStatus` | String | Yes | - | `'PURCHASED'` / `'LEAD'` / `'INACTIVE'` 등 |
| `totalTripCount` | Int | No | `0` | 총 여행 횟수 |
| `tripCount` | Int | No | `0` | 현재 여행 횟수 |
| `loginCount` | Int | No | `0` | 로그인 횟수 |
| `isLocked` | Boolean | No | `false` | 계정 잠금 여부 |
| `isHibernated` | Boolean | No | `false` | 휴면 여부 |
| `lastActiveAt` | DateTime | Yes | - | 마지막 활동 일시 |
| `createdAt` | DateTime | No | `now()` | 가입일 |
| `updatedAt` | DateTime | No | - | 수정일 |
| `sourceAgentId` | Int | Yes | - | 가입 유도 판매원 ID |
| `adminMemo` | String | Yes | - | 어드민 메모 |

---

### 3.2 AffiliateProfile

> 판매원(프리세일즈·세일즈·대리점장)의 파트너 프로필. User와 1:1.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `userId` | Int | No | - | User FK (unique) |
| `type` | String | No | - | `'SALES_AGENT'` / `'BRANCH_MANAGER'` / `'HQ'` |
| `status` | String | No | `'DRAFT'` | 상태값 (아래 별도 표) |
| `contractStatus` | String | No | `'DRAFT'` | 계약 상태 (아래 별도 표) |
| `isActive` | Boolean | No | `true` | 활성 여부 |
| `affiliateCode` | String | No | - | 파트너 고유 코드 (unique) |
| `displayName` | String | Yes | - | 표시 이름 |
| `branchLabel` | String | Yes | - | 대리점 이름 |
| `contactPhone` | String | Yes | - | 파트너 연락처 |
| `contactEmail` | String | Yes | - | 파트너 이메일 |
| `bankName` | String | Yes | - | 은행명 |
| `bankAccount` | String | Yes | - | 계좌번호 |
| `bankAccountHolder` | String | Yes | - | 예금주 |
| `withholdingRate` | Float | No | `3.3` | 원천징수율 (%) |
| `agentCommissionRate` | Int | Yes | - | 개인 수수료율 오버라이드 |
| `contractSignedAt` | DateTime | Yes | - | 계약 서명일 |
| `kycCompletedAt` | DateTime | Yes | - | KYC 완료일 |
| `onboardedAt` | DateTime | Yes | - | 온보딩 완료일 |
| `lastSalesDate` | DateTime | Yes | - | 마지막 판매일 |
| `deactivatedAt` | DateTime | Yes | - | 비활성화 일시 |
| `deactivationReason` | String | Yes | - | 비활성화 사유 |
| `suspendedAt` | DateTime | Yes | - | **정지 일시** (크론 자동 또는 수동) |
| `suspensionReason` | String | Yes | - | **정지 사유** (크론 기록 또는 어드민 입력) |
| `autoSuspended` | Boolean | No | `false` | **자동 정지 여부** (`true`=크론, `false`=수동) |
| `gracePeriodStartDate` | DateTime | Yes | - | 유예기간 시작일 |
| `landingSlug` | String | Yes | - | 랜딩 페이지 slug (unique) |
| `createdAt` | DateTime | No | `now()` | 생성일 |
| `updatedAt` | DateTime | No | - | 수정일 |

#### AffiliateProfile.status 값 정의

| 값 | 설명 | CRM 표시 |
|----|------|---------|
| `'DRAFT'` | 가입 신청 접수 | 심사 대기 |
| `'AWAITING_APPROVAL'` | 승인 대기 | 검토 중 |
| `'ACTIVE'` | 활성 파트너 | 정상 |
| `'SUSPENDED'` | 정지 | 판매 불가 — `autoSuspended` 확인 필요 |
| `'TERMINATED'` | 계약 해지 | 영구 종료 |

#### AffiliateProfile.contractStatus 값 정의

| 값 | 설명 |
|----|------|
| `'DRAFT'` | 계약 미작성 |
| `'PENDING_SIGNATURE'` | 서명 대기 |
| `'SIGNED'` | 서명 완료 |
| `'APPROVED'` | 승인 완료 |
| `'REJECTED'` | 반려 |

#### 정지 처리 규칙 (CRITICAL)

```sql
-- ✅ 자동 정지 확인 (크론잡이 정지한 건)
WHERE status = 'SUSPENDED' AND "autoSuspended" = true

-- ✅ 수동 정지 확인 (어드민이 정지한 건)
WHERE status = 'SUSPENDED' AND "autoSuspended" = false

-- ✅ 정지 해제 시 반드시 3개 필드 초기화 (중요!)
UPDATE "AffiliateProfile"
SET status = 'ACTIVE',
    "isActive" = true,
    "suspendedAt" = NULL,
    "suspensionReason" = NULL,
    "autoSuspended" = false
WHERE id = :profileId;
-- ❌ status만 바꾸면 크론이 다음날 다시 정지시킴
```

---

### 3.3 AffiliateRelation

> 대리점장(manager) ↔ 판매원(agent) 연결 관계.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `managerId` | Int | No | - | AffiliateProfile FK (대리점장) |
| `agentId` | Int | No | - | AffiliateProfile FK (판매원) |
| `status` | String | No | `'ACTIVE'` | `'ACTIVE'` / `'TERMINATED'` |
| `connectedAt` | DateTime | Yes | - | 연결 일시 |
| `disconnectedAt` | DateTime | Yes | - | 해제 일시 |
| `overrideRate` | Float | Yes | - | 오버라이드 수수료율 |
| `createdAt` | DateTime | No | `now()` | 생성일 |

```sql
-- 대리점장의 소속 판매원 전체 조회
SELECT u.name, u.phone, ap.status, ap."autoSuspended"
FROM "AffiliateRelation" ar
JOIN "AffiliateProfile" ap ON ap.id = ar."agentId"
JOIN "User" u ON u.id = ap."userId"
WHERE ar."managerId" = :managerProfileId
  AND ar.status = 'ACTIVE';
```

---

### 3.4 AffiliateSale

> 판매 실적 테이블. 결제 완료·수동 입력 시 생성.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `externalOrderCode` | String | Yes | - | PG 주문번호 (unique) |
| `agentId` | Int | Yes | - | 담당 판매원 AffiliateProfile ID |
| `managerId` | Int | Yes | - | 담당 대리점장 AffiliateProfile ID |
| `leadId` | Int | Yes | - | AffiliateLead FK |
| `linkId` | Int | Yes | - | AffiliateLink FK |
| `productCode` | String | Yes | - | 상품 코드 |
| `cabinType` | String | Yes | - | 선실 타입 |
| `headcount` | Int | Yes | - | 인원수 |
| `saleAmount` | Int | No | - | 판매금액 (원) |
| `salesCommission` | Int | Yes | - | 판매원 수수료 (실제 계산값) |
| `branchCommission` | Int | Yes | - | 대리점 수수료 |
| `overrideCommission` | Int | Yes | - | 오버라이드 수수료 |
| `withholdingAmount` | Int | Yes | - | 원천징수액 |
| `netRevenue` | Int | Yes | - | 순수익 |
| `commissionRate` | Int | Yes | - | 수수료율 스냅샷 (%) |
| `commissionRateSnapshot` | Json | Yes | - | 수수료 티어 전체 스냅샷 |
| `status` | String | No | `'PENDING'` | 판매 상태 (아래 표) |
| `yearMonth` | String | Yes | - | 판매월 KST 기준 `'YYYY-MM'` (**중요**) |
| `saleDate` | DateTime | Yes | - | 판매일 |
| `confirmedAt` | DateTime | Yes | - | 확정일 |
| `settledAt` | DateTime | Yes | - | 정산 완료일 |
| `paidAt` | DateTime | Yes | - | 지급일 |
| `refundedAt` | DateTime | Yes | - | 환불일 |
| `refundReason` | String | Yes | - | 환불 사유 |
| `sourceAgentId` | Int | Yes | - | 원본 판매원 (재배정 시 이전 담당자) |
| `submittedAt` | DateTime | Yes | - | 제출일 |
| `approvedAt` | DateTime | Yes | - | 승인일 |
| `createdAt` | DateTime | No | `now()` | 생성일 |
| `updatedAt` | DateTime | No | - | 수정일 |

#### AffiliateSale.status 값 정의

| 값 | 설명 | 수수료 지급 대상 |
|----|------|--------------|
| `'PENDING'` | 접수 대기 | No |
| `'PENDING_APPROVAL'` | 승인 대기 | No |
| `'APPROVED'` | 승인 완료 | **Yes** |
| `'CONFIRMED'` | 확정 (출발 완료) | **Yes** |
| `'REJECTED'` | 반려 | No |
| `'REFUNDED'` | 환불 처리 | No (차감) |
| `'CANCELLED'` | 취소 | No |

#### yearMonth 규칙 (CRITICAL)

```sql
-- 올바른 yearMonth 집계 (KST 기준)
SELECT "yearMonth", SUM("saleAmount") as total
FROM "AffiliateSale"
WHERE "agentId" = :agentId
  AND status IN ('APPROVED', 'CONFIRMED')
  AND "yearMonth" IS NOT NULL
GROUP BY "yearMonth"
ORDER BY "yearMonth" DESC;

-- yearMonth가 NULL인 레거시 데이터 fallback
SELECT
  COALESCE(
    "yearMonth",
    TO_CHAR("saleDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM')
  ) as month,
  SUM("saleAmount")
FROM "AffiliateSale"
WHERE "agentId" = :agentId
GROUP BY 1;
```

#### 환불율 계산

```sql
-- 판매원 환불율 계산
SELECT
  "agentId",
  ROUND(
    CAST(SUM(CASE WHEN status = 'REFUNDED' THEN "saleAmount" ELSE 0 END) AS FLOAT)
    / NULLIF(SUM(CASE WHEN status IN ('APPROVED','CONFIRMED','REFUNDED') THEN "saleAmount" ELSE 0 END), 0)
    * 100,
    1
  ) as refund_rate
FROM "AffiliateSale"
WHERE "agentId" = :agentId
GROUP BY "agentId";
-- 기준: 30% 이상이면 자동 정지 대상
```

---

### 3.5 AffiliateLead

> 판매원이 관리하는 고객 리드.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `agentId` | Int | Yes | - | 담당 판매원 AffiliateProfile ID |
| `managerId` | Int | Yes | - | 담당 대리점장 ID |
| `customerName` | String | Yes | - | 고객명 |
| `customerPhone` | String | Yes | - | 고객 전화번호 (unique) |
| `status` | String | No | `'NEW'` | 리드 상태 (아래 표) |
| `leadScore` | Int | No | `0` | 리드 점수 (0~100) |
| `leadStage` | String | No | `'NURTURE'` | 단계 |
| `source` | String | Yes | - | 유입 경로 |
| `lastContactedAt` | DateTime | Yes | - | 마지막 연락일 |
| `nextActionAt` | DateTime | Yes | - | 다음 액션 예정일 |
| `notes` | String | Yes | - | 메모 |
| `groupId` | Int | Yes | - | CustomerGroup FK |
| `registeredAt` | DateTime | No | `now()` | 등록일 |
| `registeredByProfileId` | Int | Yes | - | 등록한 파트너 프로필 ID |
| `createdAt` | DateTime | No | `now()` | 생성일 |

#### AffiliateLead.status 값 정의

| 값 | 설명 |
|----|------|
| `'NEW'` | 신규 리드 |
| `'CONTACTED'` | 연락 완료 |
| `'INTERESTED'` | 관심 있음 |
| `'DEMO_SCHEDULED'` | 상담 예약 |
| `'PROPOSAL_SENT'` | 제안서 발송 |
| `'NEGOTIATING'` | 협의 중 |
| `'PURCHASED'` | 구매 완료 |
| `'LOST'` | 이탈 |
| `'INACTIVE'` | 비활성 |

---

### 3.6 AffiliateLink

> 판매원이 사용하는 공유링크 (트래킹 URL).

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `code` | String | No | - | 링크 코드 (unique) |
| `agentId` | Int | Yes | - | 담당 판매원 ID |
| `managerId` | Int | Yes | - | 담당 대리점장 ID |
| `productCode` | String | Yes | - | 연결된 상품 코드 |
| `status` | String | No | `'ACTIVE'` | `'ACTIVE'` / `'SUSPENDED'` / `'EXPIRED'` |
| `clickCount` | Int | No | `0` | 클릭 수 |
| `campaignName` | String | Yes | - | 캠페인명 |
| `expiresAt` | DateTime | Yes | - | 만료일 |
| `createdAt` | DateTime | No | `now()` | 생성일 |

> **주의**: 판매원이 `SUSPENDED`되면 해당 판매원의 모든 링크도 `status = 'SUSPENDED'`로 변경됨.

---

### 3.7 AffiliatePayslip

> 월별 수당 지급명세서.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `profileId` | Int | No | - | AffiliateProfile FK |
| `period` | String | No | - | 정산 기간 (`'2026-04'` 형식) |
| `type` | String | No | - | `'MONTHLY'` / `'BONUS'` 등 |
| `status` | String | No | `'PENDING'` | `'PENDING'` / `'APPROVED'` / `'PAID'` |
| `totalSales` | Int | No | `0` | 총 판매금액 |
| `totalCommission` | Int | No | `0` | 총 수수료 |
| `totalWithholding` | Int | No | `0` | 총 원천징수액 |
| `netPayment` | Int | No | `0` | 실지급액 |
| `approvedAt` | DateTime | Yes | - | 승인일 |
| `pdfUrl` | String | Yes | - | 지급명세서 PDF URL |
| `createdAt` | DateTime | No | `now()` | 생성일 |

---

### 3.8 CommissionLedger

> 수수료 원장 — AffiliateSale 1건당 엔트리 N개 (판매원/대리점/본사 분배).

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `saleId` | Int | No | - | AffiliateSale FK |
| `profileId` | Int | Yes | - | AffiliateProfile FK (수령인) |
| `agentId` | Int | Yes | - | 판매원 ID (집계용) |
| `entryType` | String | No | - | `'SALES'` / `'BRANCH'` / `'OVERRIDE'` / `'HQ'` |
| `amount` | Int | No | - | 수수료 금액 |
| `withholdingAmount` | Int | Yes | - | 원천징수액 |
| `isSettled` | Boolean | No | `false` | 정산 완료 여부 |
| `settleableAfter` | DateTime | Yes | - | 정산 가능 일시 (출발 후 30일) |
| `settlementId` | Int | Yes | - | Settlement FK |
| `createdAt` | DateTime | No | `now()` | 생성일 |

---

### 3.9 Settlement

> 판매원별 월간 정산 요약.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `affiliateId` | Int | No | - | AffiliateProfile FK |
| `month` | String | No | - | 정산월 `'YYYY-MM'` |
| `totalSales` | Int | No | `0` | 총 판매금액 |
| `totalCommission` | Int | No | `0` | 총 수수료 |
| `paidAmount` | Int | No | `0` | 실지급액 |
| `status` | String | No | `'PENDING'` | `'PENDING'` / `'PAID'` |
| `paidAt` | DateTime | Yes | - | 지급일 |
| `createdAt` | DateTime | No | `now()` | 생성일 |

---

### 3.10 GoldMember

> 골드회원 (크루즈닷 상품 구매 고객).

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `userId` | Int | Yes | - | User FK |
| `name` | String | No | - | 이름 |
| `phone` | String | No | - | 전화번호 |
| `tier` | Int | No | - | 등급 (1=최상위) |
| `status` | String | No | `'active'` | `'active'` / `'inactive'` |
| `paymentCount` | Int | No | `0` | 현재 납입 횟수 |
| `maxPaymentCount` | Int | Yes | - | 총 납입 예정 횟수 |
| `productType` | String | Yes | - | 상품 유형 |
| `startDate` | DateTime | No | - | 가입일 |
| `managerId` | Int | Yes | - | 담당 대리점장 AffiliateProfile ID |
| `agentId` | Int | Yes | - | 담당 판매원 AffiliateProfile ID |
| `memo` | String | Yes | - | 메모 |
| `deletedAt` | DateTime | Yes | - | 소프트 삭제 (null=활성) |
| `createdAt` | DateTime | No | `now()` | 생성일 |

---

### 3.11 Reservation

> 크루즈 예약.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `tripId` | Int | No | - | Trip FK |
| `mainUserId` | Int | No | - | User FK (예약자) |
| `affiliateSaleId` | Int | Yes | - | AffiliateSale FK |
| `totalPeople` | Int | No | - | 총 인원 |
| `cabinType` | String | Yes | - | 선실 타입 |
| `paymentAmount` | Int | Yes | - | 결제금액 |
| `status` | String | No | `'CONFIRMED'` | `'CONFIRMED'` / `'CANCELLED'` / `'PENDING'` |
| `passportStatus` | String | No | `'PENDING'` | 여권 제출 상태 |
| `pnrStatus` | String | No | `'PENDING'` | PNR 상태 |
| `createdAt` | DateTime | No | `now()` | 예약일 |

---

### 3.12 Trip (여행 일정)

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `productCode` | String | No | - | 상품 코드 (unique) |
| `shipName` | String | No | - | 선박명 |
| `departureDate` | DateTime | No | - | 출발일 |
| `endDate` | DateTime | Yes | - | 종료일 |
| `status` | String | No | `'Upcoming'` | `'Upcoming'` / `'Ongoing'` / `'Completed'` |
| `createdAt` | DateTime | No | `now()` | 생성일 |

---

### 3.13 AffiliateContract

> 판매원 가입 계약서.

| 필드명 | 타입 | NULL | Default | 설명 |
|--------|------|------|---------|------|
| `id` | Int | No | auto | PK |
| `userId` | Int | Yes | - | User FK |
| `invitedByProfileId` | Int | Yes | - | 초대한 대리점장 AffiliateProfile ID |
| `name` | String | No | - | 계약자 이름 |
| `phone` | String | No | - | 전화번호 |
| `status` | String | No | `'submitted'` | `'submitted'` / `'approved'` / `'rejected'` |
| `contractSignedAt` | DateTime | Yes | - | 서명일 |
| `reviewedAt` | DateTime | Yes | - | 검토일 |
| `reviewerId` | Int | Yes | - | 검토한 어드민 ID |
| `bankName` | String | Yes | - | 은행명 |
| `bankAccount` | String | Yes | - | 계좌번호 |
| `bankAccountHolder` | String | Yes | - | 예금주 |
| `submittedAt` | DateTime | No | `now()` | 제출일 |

---

## 4. 자동 정지 시스템 (프리세일즈 전용)

### 4.1 크론잡 스케줄

| 항목 | 내용 |
|------|------|
| 실행 시간 | **매일 UTC 01:00 (KST 10:00)** |
| 대상 | `type = 'SALES_AGENT'` AND `mallUserId ILIKE 'pre%'` AND `status != 'SUSPENDED'` |
| 정지 조건 1 | 환불율 **≥ 30%** |
| 정지 조건 2 | 최근 5개월 **전체** 확정 매출 0원 (`APPROVED` / `CONFIRMED` 건 없음) |

### 4.2 정지 시 자동 처리

```sql
-- 크론이 실행하는 동작 (트랜잭션)
UPDATE "AffiliateProfile" SET
  status = 'SUSPENDED',
  "isActive" = false,
  "deactivatedAt" = NOW(),
  "deactivationReason" = '자동 정지 사유',
  "suspendedAt" = NOW(),
  "suspensionReason" = '환불율 XX.X% 초과 자동 정지 (기준: 30%)',  -- 또는 '최근 5개월 매출 0원 자동 정지'
  "autoSuspended" = true
WHERE id = :profileId;

UPDATE "AffiliateLink" SET status = 'SUSPENDED'
WHERE "agentId" = :profileId AND status = 'ACTIVE';
```

### 4.3 CRM에서 정지 해제 시 필수 처리

```sql
-- ✅ 반드시 이 SQL로 해제 (suspension 필드 초기화 포함)
UPDATE "AffiliateProfile" SET
  status = 'ACTIVE',
  "isActive" = true,
  "suspendedAt" = NULL,
  "suspensionReason" = NULL,
  "autoSuspended" = false
WHERE id = :profileId;

-- 링크도 함께 복구
UPDATE "AffiliateLink" SET status = 'ACTIVE'
WHERE "agentId" = :profileId AND status = 'SUSPENDED';
```

---

## 5. 인덱스 현황 (성능 최적화)

| 인덱스명 | 테이블 | 컬럼 | 용도 |
|---------|--------|------|------|
| `AffiliateSale_agentId_yearMonth_idx` | AffiliateSale | `(agentId, yearMonth)` | 판매원별 월별 집계 |
| `AffiliateSale_managerId_yearMonth_idx` | AffiliateSale | `(managerId, yearMonth)` | 대리점별 월별 집계 |

> `yearMonth` 기반 쿼리 시 반드시 `agentId` 또는 `managerId`를 함께 조건에 포함해야 인덱스가 활용됨.

---

## 6. 주요 조인 패턴

### 6.1 판매원 전체 현황 (판매 통계 포함)

```sql
SELECT
  u.name,
  u.phone,
  u."mallUserId",
  ap.type,
  ap.status,
  ap."autoSuspended",
  ap."suspensionReason",
  ap."suspendedAt",
  COUNT(DISTINCT al.id) FILTER (WHERE al.status = 'ACTIVE') as active_links,
  COUNT(DISTINCT als.id) FILTER (WHERE als.status IN ('APPROVED','CONFIRMED')) as confirmed_sales,
  SUM(CASE WHEN als.status IN ('APPROVED','CONFIRMED') THEN als."saleAmount" ELSE 0 END) as total_sale_amount,
  SUM(CASE WHEN als.status = 'REFUNDED' THEN als."saleAmount" ELSE 0 END) as total_refund_amount
FROM "AffiliateProfile" ap
JOIN "User" u ON u.id = ap."userId"
LEFT JOIN "AffiliateLink" al ON al."agentId" = ap.id
LEFT JOIN "AffiliateSale" als ON als."agentId" = ap.id
WHERE ap.type = 'SALES_AGENT'
GROUP BY u.name, u.phone, u."mallUserId", ap.type, ap.status, ap."autoSuspended", ap."suspensionReason", ap."suspendedAt"
ORDER BY total_sale_amount DESC;
```

### 6.2 대리점장 + 소속 판매원 + 월별 실적

```sql
SELECT
  manager_u.name as manager_name,
  agent_u.name as agent_name,
  agent_u."mallUserId",
  als."yearMonth",
  SUM(als."saleAmount") as monthly_sales,
  SUM(COALESCE(als."salesCommission", FLOOR(als."saleAmount" * 0.03))) as commission
FROM "AffiliateRelation" ar
JOIN "AffiliateProfile" manager_ap ON manager_ap.id = ar."managerId"
JOIN "User" manager_u ON manager_u.id = manager_ap."userId"
JOIN "AffiliateProfile" agent_ap ON agent_ap.id = ar."agentId"
JOIN "User" agent_u ON agent_u.id = agent_ap."userId"
LEFT JOIN "AffiliateSale" als
  ON als."agentId" = agent_ap.id
  AND als.status IN ('APPROVED', 'CONFIRMED')
  AND als."yearMonth" IS NOT NULL
WHERE ar.status = 'ACTIVE'
  AND als."yearMonth" >= '2026-01'
GROUP BY manager_u.name, agent_u.name, agent_u."mallUserId", als."yearMonth"
ORDER BY als."yearMonth" DESC, monthly_sales DESC;
```

### 6.3 골드회원 담당 판매원 연결

```sql
SELECT
  gm.name as gold_member_name,
  gm.phone,
  gm.tier,
  gm.status,
  gm."paymentCount",
  gm."maxPaymentCount",
  agent_u.name as agent_name,
  manager_u.name as manager_name
FROM "GoldMember" gm
LEFT JOIN "AffiliateProfile" agent_ap ON agent_ap.id = gm."agentId"
LEFT JOIN "User" agent_u ON agent_u.id = agent_ap."userId"
LEFT JOIN "AffiliateProfile" manager_ap ON manager_ap.id = gm."managerId"
LEFT JOIN "User" manager_u ON manager_u.id = manager_ap."userId"
WHERE gm."deletedAt" IS NULL
ORDER BY gm."createdAt" DESC;
```

---

## 7. 최근 마이그레이션 이력 (2026년 5월 기준)

| 날짜 | 내용 | 테이블 | 적용 여부 |
|------|------|--------|---------|
| 2026-05-07 | `suspendedAt`, `suspensionReason`, `autoSuspended` 추가 | `AffiliateProfile` | ✅ 적용 |
| 2026-05-07 | `yearMonth`, `commissionRate`, `commissionRateSnapshot`, `settledAt`, `sourceAgentId` 추가 | `AffiliateSale` | ✅ 적용 |
| 2026-05-07 | `AffiliateSale_agentId_yearMonth_idx` 인덱스 생성 | `AffiliateSale` | ✅ 적용 |
| 2026-05-07 | `AffiliateSale_managerId_yearMonth_idx` 인덱스 생성 | `AffiliateSale` | ✅ 적용 |
| 2026-05-07 | 기존 NULL yearMonth 데이터 KST 기준 백필 (1건) | `AffiliateSale` | ✅ 적용 |

---

## 8. 절대 금지 사항

| 금지 항목 | 이유 |
|-----------|------|
| `User.password` 컬럼 직접 읽기 | 해시값이라도 민감정보 |
| `AffiliateProfile.status` 만 변경 (suspension 필드 미초기화) | 크론잡이 다음날 재정지함 |
| `yearMonth` 없이 AffiliateSale 생성 | 크론 5개월 집계 오작동 |
| 물리 삭제 (`DELETE FROM`) | 소프트 삭제 패턴 사용 중 — `deletedAt` 컬럼 확인 |
| `AffiliateProfile.type`을 `'PRESALES'`로 저장 | 해당 값 미사용, 기존 코드와 충돌 |

---

## 9. 환경 정보

| 항목 | 값 |
|------|-----|
| DB | Neon PostgreSQL (serverless) |
| Schema | `public` |
| Timezone | **UTC 저장, KST(+9) 표시** |
| ORM | Prisma (GMcruise 앱) |
| yearMonth 형식 | `'YYYY-MM'` CHAR(7), KST 기준 |
| 수수료 기본율 (프리세일즈) | `3%` (`salesCommission` NULL 시 추정값) |
| 원천징수율 기본 | `3.3%` |

---

*이 문서는 GMcruise 코드베이스(`D:\GMcruise`)와 Neon DB를 직접 분석하여 작성됨.*  
*스키마 변경 시 GMcruise 개발팀에 알리고 이 문서를 업데이트할 것.*
