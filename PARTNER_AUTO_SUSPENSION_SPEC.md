# 파트너 자동 정지 규칙 구현 작업지시서

## Executive Summary

### 목표
크루즈닷 대리점 파트너(대리점장, 판매원, 프리세일즈)의 성과 부진 시 자동으로 계약 정지하여 플랫폼 건전성 유지 및 불량 파트너 적극 관리

### 정지 조건 (OR 로직)
1. **높은 환불율**: 최근 3개월 환불율 ≥ 30% (3개월 모두 해당)
2. **매출 부진**: 최근 5개월 매출 = 0 (5개월 연속)

### 결과
- 파트너 ID 정지 (로그인 불가)
- 계약 상태 자동 변경 (ACTIVE → SUSPENDED)
- 관리자 알람 (이메일 + 대시보드 배지)

### 대상
- 대리점장 (Partner.role = 'MANAGER')
- 판매원 (Partner.role = 'SALESPERSON')
- 프리세일즈 (Partner.role = 'PRESALES')

**제외**: 통제사 이상 역할 (Partner.role = 'DIRECTOR+')

### 예상 영향
- 현재 파트너 수: ~200명 (2026-05-17 기준)
- 예상 정지 대상: 10-20명 (5-10%)

### 총 소요 시간
- **DB 마이그레이션**: 2시간
- **API 구현**: 8시간
- **UI 구현**: 6시간
- **테스트 및 운영가이드**: 4시간
- **총 20시간 (2-3일)**

---

## 1. 기술 설계

### 1.1 핵심 개념 정의

#### 최근 3개월
현재 달 기준 지난 3개월 완전 기간 (30일 기준)

```
예시 (2026-05-17 기준):
- 포함: 2026-02월, 2026-03월, 2026-04월
- 제외: 2026-05월 (진행 중)
```

#### 환불율 계산
```
환불율 = SUM(환불액) / SUM(전체 매출액) × 100

환불액: 
  - AffiliateSale.status IN ('CANCELLED', 'REFUNDED')의 합계
  - 또는 AffiliateSale.refundAmount가 0이 아닌 경우

전체 매출액:
  - PartnerMetrics.revenue의 해당 월 합계
  - 또는 AffiliateSale.amount (status IN ('CONFIRMED', 'COMPLETED'))
```

#### 최근 5개월 매출 0
```
5개월 연속 SUM(매출액) = 0 의미:
- PartnerMetrics[month-5].revenue = 0
- PartnerMetrics[month-4].revenue = 0
- PartnerMetrics[month-3].revenue = 0
- PartnerMetrics[month-2].revenue = 0
- PartnerMetrics[month-1].revenue = 0

예시 (2026-05-17 기준):
- 포함: 2025-12월, 2026-01월, 2026-02월, 2026-03월, 2026-04월
```

### 1.2 DB 스키마 변경

#### 1.2.1 Organization 모델 확장

```prisma
model Organization {
  // ... 기존 필드
  
  // 자동 정지 관련
  partnerSuspensions  PartnerSuspension[]
  
  @@index([status])
  @@index([contractRef])
}
```

#### 1.2.2 새로운 모델: PartnerSuspension

```prisma
model PartnerSuspension {
  id                    String       @id @default(cuid())
  organizationId        String
  partnerId             String?      // Organization (파트너명 저장)
  partnerName           String
  partnerRole           String       // MANAGER | SALESPERSON | PRESALES
  
  suspensionStatus      String       @default("SUSPENDED")  // SUSPENDED | APPEALING | RESOLVED
  suspensionReason      String       // HIGH_REFUND | NO_REVENUE | MANUAL
  reasonDetails         Json?        // { refundRate: 35.2, monthsAffected: [2,3,4], ... }
  
  suspendedAt           DateTime     @db.Timestamptz(6)
  suspendedByAdminId    String?      // 수동 정지 시 관리자 ID
  
  appealedAt            DateTime?    @db.Timestamptz(6)
  appealMessage         String?
  
  resolvedAt            DateTime?    @db.Timestamptz(6)
  resolutionNotes       String?      // 해제 사유 기록
  
  contractRef           String?      // Organization.contractRef와 매핑
  
  createdAt             DateTime     @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime     @updatedAt @db.Timestamptz(6)
  
  organization          Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, partnerId])
  @@index([organizationId, suspensionStatus])
  @@index([suspendedAt])
  @@index([resolvedAt])
  @@map("PartnerSuspension")
}
```

#### 1.2.3 Organization.status 확장

```
기존: ACTIVE | INACTIVE | PAUSED
신규: ACTIVE | INACTIVE | PAUSED | SUSPENDED (파트너 정지 시)
```

**마이그레이션:**
```sql
-- 1. PartnerSuspension 테이블 생성
CREATE TABLE "PartnerSuspension" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organizationId TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  partnerId TEXT,
  partnerName TEXT NOT NULL,
  partnerRole TEXT NOT NULL,
  suspensionStatus TEXT NOT NULL DEFAULT 'SUSPENDED',
  suspensionReason TEXT NOT NULL,
  reasonDetails JSONB,
  suspendedAt TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  suspendedByAdminId TEXT,
  appealedAt TIMESTAMPTZ(6),
  appealMessage TEXT,
  resolvedAt TIMESTAMPTZ(6),
  resolutionNotes TEXT,
  contractRef TEXT,
  createdAt TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updatedAt TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "PartnerSuspension_organizationId_partnerId_key"
  ON "PartnerSuspension"(organizationId, partnerId);

CREATE INDEX "PartnerSuspension_organizationId_suspensionStatus_idx"
  ON "PartnerSuspension"(organizationId, suspensionStatus);

CREATE INDEX "PartnerSuspension_suspendedAt_idx"
  ON "PartnerSuspension"(suspendedAt);

-- 2. Organization에 SUSPENDED 상태 허용
-- (ALTER TABLE 불필요 - 기존 VARCHAR이므로 값만 추가됨)

-- 3. Neon/Supabase에 트리거 추가 (옵션)
CREATE OR REPLACE FUNCTION update_partner_suspension_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_partner_suspension_updated_at
BEFORE UPDATE ON "PartnerSuspension"
FOR EACH ROW
EXECUTE FUNCTION update_partner_suspension_updated_at();
```

---

## 2. API 엔드포인트 설계

### 2.1 GET /api/admin/partner-suspensions
**목적**: 정지된 파트너 목록 조회 + 정지 예상 파트너 식별

**인증**: GlobalAdmin 또는 Organization.role = 'OWNER'

**쿼리 파라미터**:
```typescript
{
  organizationId?: string;       // 조직 필터
  status?: 'SUSPENDED' | 'APPEALING' | 'RESOLVED';
  reason?: 'HIGH_REFUND' | 'NO_REVENUE';
  sortBy?: 'suspendedAt' | 'partnerName';  // 기본값: suspendedAt DESC
  page?: number;                // 기본값: 1
  limit?: number;               // 기본값: 20, 최대: 100
  preview?: boolean;            // true = 정지 예상 파트너까지 포함 (배치 실행 전 미리보기)
}
```

**응답**:
```typescript
{
  success: boolean;
  data: {
    suspensions: Array<{
      id: string;
      organizationId: string;
      partnerId: string | null;
      partnerName: string;
      partnerRole: string;       // MANAGER | SALESPERSON | PRESALES
      suspensionStatus: string;  // SUSPENDED | APPEALING | RESOLVED
      suspensionReason: string;  // HIGH_REFUND | NO_REVENUE
      reasonDetails: {
        refundRate?: number;     // 예: 35.2
        refundMonths?: number[]; // [2, 3, 4] (2월, 3월, 4월)
        zeroRevenueMonths?: number[];
      };
      suspendedAt: string;       // ISO 8601
      suspendedByAdminId?: string;
      appealedAt?: string;
      appealMessage?: string;
      contractRef?: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}
```

### 2.2 POST /api/admin/partner-suspensions/check-candidates
**목적**: 자동 정지 대상 파트너 미리보기 (배치 실행 전)

**인증**: GlobalAdmin 전용

**요청 본문**:
```typescript
{
  dryRun: boolean;  // true = 실제 변경 안 함, 결과만 조회
}
```

**응답**:
```typescript
{
  success: boolean;
  data: {
    highRefundPartners: Array<{
      organizationId: string;
      partnerId?: string;
      partnerName: string;
      partnerRole: string;
      refundRate: number;        // 예: 35.2
      affectedMonths: number[];  // [2, 3, 4]
      totalRevenue: number;
      totalRefund: number;
    }>;
    zeroRevenuePartners: Array<{
      organizationId: string;
      partnerId?: string;
      partnerName: string;
      partnerRole: string;
      zeroMonths: number[];      // [12, 1, 2, 3, 4]
    }>;
    totalCandidates: number;
    executedAt: string;
  };
  error?: string;
}
```

### 2.3 POST /api/admin/partner-suspensions/execute
**목적**: 자동 정지 배치 실행 (월 1일 00:00 또는 수동 트리거)

**인증**: GlobalAdmin 전용

**요청 본문**:
```typescript
{
  // 선택: 특정 파트너만 정지 (수동 실행)
  specificPartnerIds?: string[];
  reason?: 'HIGH_REFUND' | 'NO_REVENUE' | 'MANUAL';
  reasonNotes?: string;
}
```

**로직**:
```
1. suspensionStatus = 'SUSPENDED'인 파트너는 스킵 (중복 정지 방지)
2. 3개월 환불율 ≥ 30% 파트너 조회
3. 5개월 연속 매출 0 파트너 조회
4. UNION → 정지 대상 목록
5. 각 파트너:
   - PartnerSuspension 레코드 생성 (upsert)
   - Organization.status = 'SUSPENDED'로 변경
   - 로그 기록
6. 정지된 파트너 수 반환
7. Slack/Email 알람 발송
```

**응답**:
```typescript
{
  success: boolean;
  data: {
    suspendedCount: number;
    details: Array<{
      organizationId: string;
      partnerName: string;
      reason: string;
      message: string;  // "3개월 평균 환불율 35.2% 초과" 등
    }>;
    executedAt: string;
  };
  error?: string;
}
```

### 2.4 POST /api/admin/partner-suspensions/[organizationId]/appeal
**목적**: 정지 파트너 이의 신청

**인증**: 해당 Organization 멤버 또는 GlobalAdmin

**요청 본문**:
```typescript
{
  message: string;  // 이의 사유 (필수, 최소 10자)
}
```

**응답**:
```typescript
{
  success: boolean;
  data: {
    suspensionId: string;
    status: 'APPEALING';
    appealedAt: string;
  };
  error?: string;
}
```

### 2.5 POST /api/admin/partner-suspensions/[organizationId]/resolve
**목적**: 정지 해제 (관리자 승인)

**인증**: GlobalAdmin 전용

**요청 본문**:
```typescript
{
  action: 'UNSUSPEND' | 'DENY_APPEAL' | 'MANUAL_REVIEW';
  notes: string;  // 해제 사유 또는 거절 사유
}
```

**로직**:
```
1. action = 'UNSUSPEND':
   - PartnerSuspension.suspensionStatus = 'RESOLVED'
   - PartnerSuspension.resolvedAt = now()
   - Organization.status = 'ACTIVE'
   - 파트너에게 해제 이메일 발송

2. action = 'DENY_APPEAL':
   - PartnerSuspension.suspensionStatus = 'SUSPENDED' (원상복귀)
   - PartnerSuspension.appealedAt = NULL
   - 파트너에게 거절 이메일 발송

3. action = 'MANUAL_REVIEW':
   - 상태 변경 안 함 (관리자가 검토 후 추후 결정)
   - 내부 노트만 기록
```

**응답**:
```typescript
{
  success: boolean;
  data: {
    suspensionId: string;
    status: 'RESOLVED' | 'SUSPENDED' | 'UNDER_REVIEW';
    resolvedAt?: string;
  };
  error?: string;
}
```

### 2.6 DELETE /api/admin/partner-suspensions/[organizationId]
**목적**: 정지 기록 삭제 (운영 목적 - 데이터 정리)

**인증**: GlobalAdmin 전용

**요청 본문**:
```typescript
{
  force?: boolean;  // true = 최근 1주일 내 정지해제 항목만 삭제 허용
}
```

---

## 3. 배치 잡 구현

### 3.1 파일 구조

```
src/lib/suspension/
  ├── calculate-refund-rate.ts    # 3개월 환불율 계산
  ├── check-zero-revenue.ts       # 5개월 매출 0 확인
  ├── find-candidates.ts          # 정지 대상 식별
  ├── execute-suspension.ts       # 정지 실행
  └── types.ts                    # 타입 정의

src/app/api/admin/partner-suspensions/
  ├── route.ts                    # GET: 목록, POST: 체크/실행
  ├── [organizationId]/
  │   ├── appeal/route.ts         # POST: 이의 신청
  │   ├── resolve/route.ts        # POST: 해제
  │   └── route.ts                # DELETE: 정지 기록 삭제

src/app/api/batch/
  └── auto-suspend/route.ts       # Vercel Cron 트리거
```

### 3.2 Vercel Cron 설정

**vercel.json** (기존 파일에 추가):
```json
{
  "crons": [
    {
      "path": "/api/batch/auto-suspend",
      "schedule": "0 0 1 * *"  // 매월 1일 00:00 UTC
    }
  ]
}
```

**환경 변수** (Vercel 프로젝트 설정):
```
CRON_SECRET=<strong-random-secret>
```

### 3.3 함수 상세 구현

#### `src/lib/suspension/calculate-refund-rate.ts`

```typescript
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export interface RefundRateResult {
  partnerId: string;
  partnerName: string;
  refundRate: number;          // 0-100
  affectedMonths: number[];    // [2, 3, 4]
  totalRevenue: number;
  totalRefund: number;
  isHighRefund: boolean;       // refundRate >= 30
}

/**
 * 최근 3개월 환불율 계산
 * @param now 기준일 (기본값: 현재)
 * @returns 정지 대상 파트너 목록 (환불율 >= 30%)
 */
export async function calculateRefundRate(
  now: Date = new Date()
): Promise<RefundRateResult[]> {
  // 현재 기준 지난 3개월 계산
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }

  // 3개월 모두 환불율 >= 30%인 파트너 조회
  const result = await prisma.$queryRaw<RefundRateResult[]>(
    Prisma.sql`
      WITH refund_data AS (
        SELECT
          p.id as "partnerId",
          p.name as "partnerName",
          pm.year,
          pm.month,
          COALESCE(pm.revenue, 0)::bigint as revenue,
          COALESCE(
            SUM(
              CASE
                WHEN sa.status IN ('CANCELLED', 'REFUNDED')
                THEN sa.refundAmount
                ELSE 0
              END
            ),
            0
          )::bigint as refund
        FROM "Partner" p
        LEFT JOIN "PartnerMetrics" pm ON p.id = pm."partnerId"
        LEFT JOIN "AffiliateSale" sa ON p.id = sa."partnerId"
          AND EXTRACT(YEAR FROM sa."createdAt") = pm.year
          AND EXTRACT(MONTH FROM sa."createdAt") = pm.month
        WHERE pm.year IN (${months[0].year}, ${months[1].year}, ${months[2].year})
          AND pm.month IN (${months[0].month}, ${months[1].month}, ${months[2].month})
        GROUP BY p.id, p.name, pm.year, pm.month, pm.revenue
      ),
      partner_refund_stats AS (
        SELECT
          "partnerId",
          "partnerName",
          ARRAY_AGG("month" ORDER BY "month") as "affectedMonths",
          SUM(revenue)::bigint as "totalRevenue",
          SUM(refund)::bigint as "totalRefund",
          CASE
            WHEN SUM(revenue) > 0
            THEN ROUND(SUM(refund)::numeric / SUM(revenue)::numeric * 100, 2)::float
            ELSE 0
          END as "refundRate"
        FROM refund_data
        GROUP BY "partnerId", "partnerName"
      )
      SELECT
        "partnerId",
        "partnerName",
        "refundRate",
        "affectedMonths",
        "totalRevenue",
        "totalRefund",
        "refundRate" >= 30 as "isHighRefund"
      FROM partner_refund_stats
      WHERE "refundRate" >= 30
    `
  );

  return result;
}
```

#### `src/lib/suspension/check-zero-revenue.ts`

```typescript
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export interface ZeroRevenueResult {
  partnerId: string;
  partnerName: string;
  zeroMonths: number[];  // [12, 1, 2, 3, 4]
  isZeroRevenue: boolean;
}

/**
 * 최근 5개월 연속 매출 0 확인
 * @param now 기준일 (기본값: 현재)
 * @returns 정지 대상 파트너 목록
 */
export async function checkZeroRevenue(
  now: Date = new Date()
): Promise<ZeroRevenueResult[]> {
  // 현재 기준 지난 5개월 계산
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }

  const monthValues = months.map((m) => `(${m.year}, ${m.month})`).join(',');

  const result = await prisma.$queryRaw<ZeroRevenueResult[]>(
    Prisma.sql`
      WITH monthly_data AS (
        SELECT
          p.id as "partnerId",
          p.name as "partnerName",
          pm.month,
          COALESCE(pm.revenue, 0) as revenue
        FROM "Partner" p
        LEFT JOIN "PartnerMetrics" pm ON p.id = pm."partnerId"
          AND (pm.year, pm.month) IN (${Prisma.raw(monthValues)})
        WHERE p."status" IN ('ACTIVE', 'INACTIVE')
      )
      SELECT
        "partnerId",
        "partnerName",
        ARRAY_AGG("month" ORDER BY "month") as "zeroMonths",
        COUNT(*) = 5 AND SUM(revenue)::bigint = 0 as "isZeroRevenue"
      FROM monthly_data
      WHERE revenue = 0
      GROUP BY "partnerId", "partnerName"
      HAVING COUNT(*) = 5
    `
  );

  return result;
}
```

#### `src/lib/suspension/find-candidates.ts`

```typescript
import prisma from '@/lib/prisma';
import { calculateRefundRate, RefundRateResult } from './calculate-refund-rate';
import { checkZeroRevenue, ZeroRevenueResult } from './check-zero-revenue';

export interface SuspensionCandidate {
  organizationId: string;
  partnerId?: string;
  partnerName: string;
  partnerRole: string;  // MANAGER | SALESPERSON | PRESALES
  suspensionReason: 'HIGH_REFUND' | 'NO_REVENUE';
  reasonDetails: {
    refundRate?: number;
    affectedMonths?: number[];
    zeroMonths?: number[];
  };
}

/**
 * 자동 정지 대상 파트너 식별
 */
export async function findSuspensionCandidates(
  now: Date = new Date()
): Promise<SuspensionCandidate[]> {
  // 1. 높은 환불율 파트너 조회
  const highRefundPartners = await calculateRefundRate(now);

  // 2. 매출 0 파트너 조회
  const zeroRevenuePartners = await checkZeroRevenue(now);

  // 3. UNION (partnerId 기준 중복 제거)
  const highRefundMap = new Map(
    highRefundPartners.map((p) => [p.partnerId, p])
  );
  const zeroRevenueMap = new Map(
    zeroRevenuePartners.map((p) => [p.partnerId, p])
  );

  const allCandidateIds = new Set([
    ...highRefundMap.keys(),
    ...zeroRevenueMap.keys(),
  ]);

  // 4. 각 파트너의 organizationId, role 조회
  const partnersData = await prisma.partner.findMany({
    where: { id: { in: Array.from(allCandidateIds) } },
    select: {
      id: true,
      name: true,
      organizationId: true,
      // role이 없으면 다른 필드로 판단 필요 (확인 필요)
    },
  });

  // 5. 결과 조립
  const candidates: SuspensionCandidate[] = partnersData
    .map((p) => {
      const highRefund = highRefundMap.get(p.id);
      const zeroRevenue = zeroRevenueMap.get(p.id);

      // 우선순위: 환불율 > 매출 0
      if (highRefund) {
        return {
          organizationId: p.organizationId,
          partnerId: p.id,
          partnerName: p.name,
          partnerRole: 'SALESPERSON', // TODO: 실제 role 필드 추가 필요
          suspensionReason: 'HIGH_REFUND',
          reasonDetails: {
            refundRate: highRefund.refundRate,
            affectedMonths: highRefund.affectedMonths,
          },
        };
      }

      if (zeroRevenue) {
        return {
          organizationId: p.organizationId,
          partnerId: p.id,
          partnerName: p.name,
          partnerRole: 'SALESPERSON',
          suspensionReason: 'NO_REVENUE',
          reasonDetails: {
            zeroMonths: zeroRevenue.zeroMonths,
          },
        };
      }

      return null;
    })
    .filter((c): c is SuspensionCandidate => c !== null);

  return candidates;
}
```

#### `src/lib/suspension/execute-suspension.ts`

```typescript
import prisma from '@/lib/prisma';
import { findSuspensionCandidates } from './find-candidates';
import { logger } from '@/lib/logger';

export interface SuspensionResult {
  organizationId: string;
  partnerName: string;
  suspensionReason: string;
  message: string;
}

/**
 * 자동 정지 배치 실행
 */
export async function executeSuspensionBatch(
  dryRun: boolean = false
): Promise<SuspensionResult[]> {
  const candidates = await findSuspensionCandidates();

  if (dryRun) {
    logger.info('[executeSuspensionBatch] DRY RUN', {
      count: candidates.length,
      candidates,
    });
    return [];
  }

  const results: SuspensionResult[] = [];

  for (const candidate of candidates) {
    try {
      // 1. 이미 SUSPENDED 상태면 스킵
      const existing = await prisma.partnerSuspension.findFirst({
        where: {
          organizationId: candidate.organizationId,
          suspensionStatus: 'SUSPENDED',
        },
      });

      if (existing) {
        logger.warn('[executeSuspensionBatch] 이미 정지됨', {
          organizationId: candidate.organizationId,
        });
        continue;
      }

      // 2. PartnerSuspension 레코드 생성
      const suspension = await prisma.partnerSuspension.upsert({
        where: {
          organizationId_partnerId: {
            organizationId: candidate.organizationId,
            partnerId: candidate.partnerId ?? null,
          },
        },
        create: {
          organizationId: candidate.organizationId,
          partnerId: candidate.partnerId,
          partnerName: candidate.partnerName,
          partnerRole: candidate.partnerRole,
          suspensionStatus: 'SUSPENDED',
          suspensionReason: candidate.suspensionReason,
          reasonDetails: candidate.reasonDetails,
          suspendedAt: new Date(),
        },
        update: {
          suspensionStatus: 'SUSPENDED',
          suspensionReason: candidate.suspensionReason,
          reasonDetails: candidate.reasonDetails,
          suspendedAt: new Date(),
        },
      });

      // 3. Organization.status = 'SUSPENDED'로 변경
      await prisma.organization.update({
        where: { id: candidate.organizationId },
        data: { status: 'SUSPENDED' },
      });

      // 4. 결과 기록
      const message =
        candidate.suspensionReason === 'HIGH_REFUND'
          ? `3개월 평균 환불율 ${candidate.reasonDetails.refundRate}% 초과`
          : `${candidate.reasonDetails.zeroMonths?.length || 5}개월 연속 매출 0`;

      results.push({
        organizationId: candidate.organizationId,
        partnerName: candidate.partnerName,
        suspensionReason: candidate.suspensionReason,
        message,
      });

      logger.info('[executeSuspensionBatch] 파트너 정지 완료', {
        organizationId: candidate.organizationId,
        suspensionId: suspension.id,
        reason: candidate.suspensionReason,
      });

      // 5. 알람 발송 (별도 함수)
      // await sendSuspensionNotification(candidate);

    } catch (err) {
      logger.error('[executeSuspensionBatch] 오류', {
        err,
        organizationId: candidate.organizationId,
      });
    }
  }

  return results;
}
```

### 3.4 배치 API 엔드포인트

#### `src/app/api/batch/auto-suspend/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { executeSuspensionBatch } from '@/lib/suspension/execute-suspension';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5분

export async function POST(req: NextRequest) {
  try {
    // Vercel Cron 인증
    const authHeader = req.headers.get('authorization');
    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        { error: '인증 실패' },
        { status: 401 }
      );
    }

    const results = await executeSuspensionBatch(false);

    logger.info('[POST /api/batch/auto-suspend]', {
      suspendedCount: results.length,
      results,
    });

    // Slack 알람 (선택)
    if (results.length > 0) {
      // await notifySlack({ results });
    }

    return NextResponse.json({
      success: true,
      data: {
        suspendedCount: results.length,
        details: results,
        executedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('[POST /api/batch/auto-suspend]', { err });
    return NextResponse.json(
      { error: '배치 실행 실패', details: String(err) },
      { status: 500 }
    );
  }
}
```

---

## 4. UI 컴포넌트

### 4.1 관리자 대시보드 알람 배지

**위치**: `src/app/(dashboard)/admin/dashboard/page.tsx`

```typescript
// 기존 코드에 추가
import { AlertCircle } from 'lucide-react';

// 대시보드 상단에 배지 추가
<div className="grid grid-cols-4 gap-4 mb-8">
  {/* 기존 카드들... */}
  
  {/* 정지 파트너 알람 */}
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-red-600">정지된 파트너</p>
        <p className="text-2xl font-bold text-red-700">
          {suspendedCount}
        </p>
      </div>
      <AlertCircle className="w-8 h-8 text-red-500" />
    </div>
    <a href="/admin/partner-suspensions" className="text-red-600 text-sm hover:underline mt-2">
      상세 보기 →
    </a>
  </div>
</div>
```

### 4.2 정지 관리 대시보드

**경로**: `src/app/(dashboard)/admin/partner-suspensions/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function PartnerSuspensionsPage() {
  const [suspensions, setSuspensions] = useState([]);
  const [filter, setFilter] = useState<'SUSPENDED' | 'APPEALING' | 'RESOLVED'>(
    'SUSPENDED'
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuspensions();
  }, [filter]);

  const fetchSuspensions = async () => {
    const res = await fetch(
      `/api/admin/partner-suspensions?status=${filter}`
    );
    const data = await res.json();
    setSuspensions(data.data.suspensions);
    setLoading(false);
  };

  const getIcon = (status: string) => {
    switch (status) {
      case 'SUSPENDED':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'APPEALING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">파트너 정지 관리</h1>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {(['SUSPENDED', 'APPEALING', 'RESOLVED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {s === 'SUSPENDED'
              ? '정지 중'
              : s === 'APPEALING'
                ? '이의 제기'
                : '해제됨'}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left">파트너명</th>
                <th className="border p-3 text-left">역할</th>
                <th className="border p-3 text-left">정지 사유</th>
                <th className="border p-3 text-left">세부 내용</th>
                <th className="border p-3 text-left">정지일</th>
                <th className="border p-3 text-left">액션</th>
              </tr>
            </thead>
            <tbody>
              {suspensions.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="border p-3">{s.partnerName}</td>
                  <td className="border p-3">{s.partnerRole}</td>
                  <td className="border p-3">
                    <span className="flex items-center gap-2">
                      {getIcon(s.suspensionStatus)}
                      {s.suspensionReason === 'HIGH_REFUND'
                        ? '높은 환불율'
                        : '매출 부진'}
                    </span>
                  </td>
                  <td className="border p-3 text-sm">
                    {s.reasonDetails.refundRate &&
                      `환불율: ${s.reasonDetails.refundRate.toFixed(1)}%`}
                    {s.reasonDetails.zeroMonths &&
                      `${s.reasonDetails.zeroMonths.length}개월 매출 0`}
                  </td>
                  <td className="border p-3 text-sm">
                    {format(new Date(s.suspendedAt), 'yyyy-MM-dd HH:mm', {
                      locale: ko,
                    })}
                  </td>
                  <td className="border p-3">
                    {filter === 'SUSPENDED' && (
                      <button
                        onClick={() => handleUnsuspend(s.id)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        해제
                      </button>
                    )}
                    {filter === 'APPEALING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveAppeal(s.id)}
                          className="text-green-600 hover:underline text-sm"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleDenyAppeal(s.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          거절
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  function handleUnsuspend(suspensionId: string) {
    // POST /api/admin/partner-suspensions/[organizationId]/resolve
  }

  function handleApproveAppeal(suspensionId: string) {
    // POST /api/admin/partner-suspensions/[organizationId]/resolve with action=UNSUSPEND
  }

  function handleDenyAppeal(suspensionId: string) {
    // POST /api/admin/partner-suspensions/[organizationId]/resolve with action=DENY_APPEAL
  }
}
```

### 4.3 파트너 대시보드 정지 배너

**위치**: `src/app/(dashboard)/partner-dashboard/page.tsx`

```typescript
// 상단에 정지 상태 확인 및 배너 표시
if (organizationStatus === 'SUSPENDED') {
  return (
    <div className="p-6">
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-bold text-red-700 mb-2">
              계약이 일시 정지되었습니다
            </h2>
            <p className="text-red-600 mb-4">
              성과 부진 등의 사유로 계약이 일시 정지되었습니다.
              상세 내용을 확인하고 필요시 이의를 제기할 수 있습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSuspensionDetails(true)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                상세 보기
              </button>
              <button
                onClick={() => setShowAppealForm(true)}
                className="px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50"
              >
                이의 제기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. 알림 및 통지

### 5.1 정지 예정 알림 (월 15일)

**이메일 템플릿**: `src/lib/email-templates.ts`

```html
<h2>파트너 계약 정지 예정 안내</h2>
<p>안녕하세요, {{partnerName}}님</p>

<p>
  귀사의 최근 성과 지표에 따라 다음 달 1일 계약이 정지될 예정입니다.
</p>

<h3>정지 사유</h3>
<ul>
  {{#if refundRate}}
  <li>높은 환불율: {{refundRate}}% (30% 이상)</li>
  {{/if}}
  {{#if zeroMonths}}
  <li>{{zeroMonths}} 개월 연속 매출 0</li>
  {{/if}}
</ul>

<p>
  이의가 있으시면 {{contactEmail}}로 연락주시기 바랍니다.
</p>
```

### 5.2 정지 완료 알림 (월 1일)

**SMS**: `알림! 파트너 계약이 정지되었습니다. 상세 내용은 CRM에서 확인하세요.`

**이메일**: 위와 동일하되 "예정"→"완료"로 변경

### 5.3 정지 해제 알림

**이메일**:
```html
<h2>파트너 계약 정지 해제 안내</h2>
<p>안녕하세요, {{partnerName}}님</p>

<p>
  관리자 검토 결과, 귀사의 계약이 복구되었습니다.
  계정에 다시 로그인하실 수 있습니다.
</p>

<p>
  문의사항은 {{contactEmail}}로 연락주시기 바랍니다.
</p>
```

---

## 6. 테스트 계획

### 6.1 단위 테스트

**파일**: `src/lib/suspension/__tests__/calculate-refund-rate.test.ts`

```typescript
import { calculateRefundRate } from '../calculate-refund-rate';
import { vi } from 'vitest';

describe('calculateRefundRate', () => {
  it('3개월 모두 환불율 30% 이상이면 정지 대상 반환', async () => {
    // Mock PartnerMetrics: 월별 매출 100,000, 환불 30,000
    // 예상 결과: refundRate = 30%
    const result = await calculateRefundRate();
    expect(result).toContainEqual(
      expect.objectContaining({
        refundRate: 30,
        isHighRefund: true,
      })
    );
  });

  it('환불율 29.99%는 정지 대상 아님', async () => {
    // Mock PartnerMetrics: 환불율 29.99%
    const result = await calculateRefundRate();
    expect(result).not.toContainEqual(
      expect.objectContaining({ isHighRefund: true })
    );
  });

  it('3개월 중 2개월만 30%는 정지 대상 아님', async () => {
    // Mock: 2월 30%, 3월 30%, 4월 20%
    const result = await calculateRefundRate();
    expect(result).not.toContainEqual(
      expect.objectContaining({ isHighRefund: true })
    );
  });
});

describe('checkZeroRevenue', () => {
  it('5개월 연속 매출 0이면 정지 대상 반환', async () => {
    // Mock PartnerMetrics: 5개월 모두 revenue = 0
    const result = await checkZeroRevenue();
    expect(result).toContainEqual(
      expect.objectContaining({ isZeroRevenue: true })
    );
  });

  it('4개월 0, 1개월만 100K는 정지 대상 아님', async () => {
    // Mock: 4개월 0, 1개월 100K
    const result = await checkZeroRevenue();
    expect(result).not.toContainEqual(
      expect.objectContaining({ isZeroRevenue: true })
    );
  });
});
```

### 6.2 통합 테스트

**파일**: `src/lib/suspension/__tests__/execute-suspension.test.ts`

```typescript
import { executeSuspensionBatch } from '../execute-suspension';
import prisma from '@/lib/prisma';

describe('executeSuspensionBatch', () => {
  it('정지 대상 파트너를 정확히 식별하고 정지 완료', async () => {
    // 1. Test fixture: 정지 대상 파트너 5명 생성 (DB)
    const testPartners = await seedTestPartners();

    // 2. 배치 실행
    const results = await executeSuspensionBatch(false);

    // 3. 검증
    expect(results).toHaveLength(5);

    // 4. DB 검증: PartnerSuspension 레코드 확인
    const suspensions = await prisma.partnerSuspension.findMany({
      where: { suspensionStatus: 'SUSPENDED' },
    });
    expect(suspensions).toHaveLength(5);

    // 5. DB 검증: Organization.status = 'SUSPENDED'
    for (const org of testPartners) {
      const updatedOrg = await prisma.organization.findUnique({
        where: { id: org.id },
      });
      expect(updatedOrg?.status).toBe('SUSPENDED');
    }
  });

  it('dryRun=true일 때 실제 변경 없음', async () => {
    const countBefore = await prisma.partnerSuspension.count();

    const results = await executeSuspensionBatch(true);

    const countAfter = await prisma.partnerSuspension.count();
    expect(countAfter).toBe(countBefore);
    expect(results).toHaveLength(0);
  });

  it('이미 SUSPENDED 파트너는 중복 정지 안 함', async () => {
    // 1. 이미 SUSPENDED 상태의 파트너 생성
    const existingSuspension = await prisma.partnerSuspension.create({
      data: {
        organizationId: 'test-org-1',
        partnerName: 'Test Partner',
        partnerRole: 'MANAGER',
        suspensionStatus: 'SUSPENDED',
        suspensionReason: 'HIGH_REFUND',
        suspendedAt: new Date(),
      },
    });

    // 2. 배치 실행
    const results = await executeSuspensionBatch(false);

    // 3. 검증: updatedAt 변경되지 않음
    const unchanged = await prisma.partnerSuspension.findUnique({
      where: { id: existingSuspension.id },
    });
    expect(unchanged?.updatedAt.getTime()).toBe(
      existingSuspension.updatedAt.getTime()
    );
  });
});
```

### 6.3 E2E 테스트 (수동)

**시나리오 1: 자동 정지 배치 실행**
```
1. 관리자 대시보드 열기
2. "정지 예상 파트너 미리보기" 클릭
3. "자동 정지 배치 실행" 클릭
4. 정지 완료 알람 확인
5. 파트너 대시보드: 정지 배너 표시 확인
```

**시나리오 2: 이의 제기 및 승인**
```
1. 파트너 대시보드에서 "이의 제기" 클릭
2. 사유 입력 후 제출
3. 관리자 대시보드: "이의 제기" 탭에서 요청 확인
4. "승인" 클릭
5. 파트너 대시보드: 정지 배너 해제 확인
6. 파트너 이메일: 해제 알림 수신 확인
```

**시나리오 3: 정지 해제 후 재활동**
```
1. 파트너가 환불율 개선 또는 매출 발생
2. 관리자가 상황 검토 후 정지 해제
3. 파트너 대시보드: 정상 상태로 복귀 확인
4. PartnerSuspension.resolvedAt 기록 확인
```

---

## 7. 운영 가이드

### 7.1 관리자용 SOP

#### 7.1.1 월 1일 00:00 자동 정지 배치 후 확인

```
1. Vercel 대시보드에서 로그 확인
   - POST /api/batch/auto-suspend 응답 코드 200 확인
   - suspendedCount 확인

2. CRM 관리자 대시보드
   - 정지된 파트너 수 확인
   - 각 파트너별 정지 사유 확인

3. Slack 알람 확인 (if configured)
   - "X명 파트너 정지" 메시지 확인

4. 파트너 이메일 발송 확인
   - 로그 확인: 모든 정지 파트너 이메일 전송됨
```

#### 7.1.2 정지 파트너 이의 제기 접수

```
1. 파트너가 CRM에서 이의 제기
   - 자동 메일 발송: "이의 제기 접수되었습니다"

2. 관리자 대시보드: "이의 제기" 탭에서 요청 확인

3. 파트너 성과 데이터 검토
   - PartnerSuspension.reasonDetails 확인
   - 최근 3개월 실제 환불율 다시 계산
   - 거래처 피드백 수집

4. 결정
   - "승인": 정지 해제 → 파트너 이메일 발송
   - "거절": 거절 사유 기록 → 파트너 이메일 발송 (추후 거절 이유 동봉)
   - "검토 중": 상태 유지 → 1주일 내 재검토
```

#### 7.1.3 정지 해제 기준

**자동 해제 가능** (즉시):
- 환불율이 3개월 연속으로 30% 미만 하락
- 매출이 최근 1개월 이상 발생

**수동 검토 필요**:
- 파트너 이의 제기 (위참고)
- 거래처 상황 변화 (인수/인계/구조조정)
- 계약 갱신 시점

**절대 해제 불가**:
- 거래처 불성실 (법적 이슈)
- 반복 정지 (2회 이상)

### 7.2 파트너용 안내

#### 7.2.1 정지 이전 알림 (월 15일)

```
1. 파트너 이메일/SMS: 정지 예정 알림
   - "3개월 환불율 35%, 기준 초과로 다음 달 1일 계약 정지"
   - "이의가 있으면 고객센터 연락"

2. CRM 대시보드: 주의 배지 표시
   - "주의: 정지 예정입니다"
```

#### 7.2.2 정지 실행 (월 1일)

```
1. 파트너 이메일/SMS: 정지 완료 알림
   - "계약이 정지되었습니다"
   - 상세 내용 링크

2. CRM 대시보드: 정지 배너
   - 정지 사유 상세 표시
   - "이의 제기" 버튼
   - 고객센터 연락처

3. 로그인: 불가
   - 에러 메시지: "계약이 정지된 상태입니다. 관리자에 문의하세요."
```

#### 7.2.3 이의 제기 (파트너 initiated)

```
1. 파트너 대시보드: "이의 제기" 클릭
   - 폼: 사유 입력 (최소 10자)
   - 제출

2. 자동 이메일: "이의 제기 접수되었습니다"
   - "3-5일 내 검토 후 결과 안내"

3. 관리자가 1주일 내 승인/거절
   - 결과 이메일 발송

4. 승인 시: 정지 해제, 로그인 가능
5. 거절 시: 상태 유지, 고객센터 상담 권유
```

### 7.3 데이터 정리 및 아카이빙

**매월 1일 배치 후** (정지 완료 후):
```
1. 이전 월 정지 기록 아카이빙
   - 6개월 이상 RESOLVED 상태 기록은 별도 테이블로 이동 (선택)
   - 또는 해당 조직으로 부터 이의가 없으면 3개월 후 Delete 가능

2. 정지 통계 수집
   - 월별 정지 파트너 수
   - 정지 이유별 분포
   - 이의 제기율, 승인율
```

---

## 8. 모니터링 및 메트릭

### 8.1 대시보드 메트릭

**위치**: `src/app/(dashboard)/admin/dashboard/page.tsx`

```
메트릭:
- 현재 정지된 파트너: N명
- 이의 제기 중: N명
- 이번 달 신규 정지: N명
- 이번 달 해제: N명
- 이의 제기율: N%
- 이의 승인율: N%
```

### 8.2 알람 조건

**Slack** (if configured):
```
1. 배치 실행 완료
   - "월 1일 자동 정지 배치 완료: N명 정지"
   
2. 이의 제기 신규
   - "파트너 [이름] 이의 제기: [사유]"
   
3. 이의 제기 대량 발생
   - 1일 내 N건 이상 → "이의 제기 급증: N건"
```

**이메일** (관리자):
```
1. 매월 1일 배치 완료 보고
   - 정지 파트너 목록
   - 정지 이유별 분포
   
2. 이의 제기 미처리 > 3일
   - "미처리 이의 제기: N건"
```

### 8.3 쿼리 모니터링

**Prisma Studio**:
```
1. PartnerSuspension 테이블
   - 월별 suspensionStatus 분포 (SUSPENDED vs RESOLVED)
   - 평균 처리 시간 (suspendedAt ~ resolvedAt)
```

**SQL 쿼리** (성능 측정):
```sql
-- 월별 정지 통계
SELECT
  DATE_TRUNC('month', "suspendedAt") as "month",
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "suspensionReason" = 'HIGH_REFUND') as high_refund,
  COUNT(*) FILTER (WHERE "suspensionReason" = 'NO_REVENUE') as no_revenue,
  COUNT(*) FILTER (WHERE "resolvedAt" IS NOT NULL) as resolved
FROM "PartnerSuspension"
GROUP BY DATE_TRUNC('month', "suspendedAt")
ORDER BY "month" DESC;
```

---

## 9. 롤백 계획

### Phase 1: 배포 전 테스트

```
1. Staging DB에서 전체 배치 테스트
   - dryRun=true로 실행
   - 정지 대상 파트너 목록 확인

2. 별도 테스트 Organization 생성
   - 환불율 >= 30% 파트너 시뮬레이션
   - 배치 수동 실행 → PartnerSuspension 생성 확인

3. 관리자 UI 테스트
   - 대시보드에서 정지 파트너 조회 확인
   - 이의 제기 폼 작동 확인
```

### Phase 2: 프로덕션 배포 (수동 트리거)

```
1. Vercel에 PartnerSuspension 마이그레이션 적용
   - prisma migrate deploy

2. API 엔드포인트 배포
   - 수동 트리거: POST /api/batch/auto-suspend 직접 호출
   - CRON_SECRET 환경변수 설정

3. Vercel Cron 활성화
   - vercel.json의 crons 배열에 추가
```

### Phase 3: 자동 실행 활성화

```
1. 월 1일 00:00 UTC에 자동 실행
   - Vercel 로그 모니터링
   - Slack 알람 확인

2. 배치 실패 시 롤백
   - 다시 실행 (재시도)
   - 또는 수동으로 API 호출
```

### 긴급 롤백

**모든 정지 파트너 일괄 해제**:
```sql
UPDATE "Organization"
SET "status" = 'ACTIVE'
WHERE "status" = 'SUSPENDED';

UPDATE "PartnerSuspension"
SET "suspensionStatus" = 'RESOLVED', "resolvedAt" = now()
WHERE "resolvedAt" IS NULL;
```

**DB 필드 제거** (완전 롤백):
```sql
DROP TABLE "PartnerSuspension" CASCADE;
-- Organization.status 값 정정 불필요 (VARCHAR이므로)
```

---

## 10. 완료 기준 (DoD)

### DB 마이그레이션 ✅
- [ ] Prisma schema에 PartnerSuspension 모델 추가
- [ ] 마이그레이션 파일 작성 및 Neon/Supabase 적용
- [ ] `prisma generate` 실행, TypeScript 타입 갱신

### API 엔드포인트 ✅
- [ ] `GET /api/admin/partner-suspensions` 구현 (목록 조회)
- [ ] `POST /api/admin/partner-suspensions/check-candidates` 구현
- [ ] `POST /api/admin/partner-suspensions/execute` 구현
- [ ] `POST /api/batch/auto-suspend/route.ts` 구현
- [ ] 각 엔드포인트 수동 테스트 통과

### 배치 로직 ✅
- [ ] `src/lib/suspension/calculate-refund-rate.ts` 구현
- [ ] `src/lib/suspension/check-zero-revenue.ts` 구현
- [ ] `src/lib/suspension/find-candidates.ts` 구현
- [ ] `src/lib/suspension/execute-suspension.ts` 구현
- [ ] 단위 테스트 모두 통과
- [ ] 통합 테스트 모두 통과

### UI 컴포넌트 ✅
- [ ] 관리자 대시보드 알람 배지 추가
- [ ] 정지 관리 대시보드 페이지 생성 (`/admin/partner-suspensions`)
- [ ] 파트너 대시보드 정지 배너 추가
- [ ] 이의 제기 폼 구현

### 알림 및 메일 ✅
- [ ] 정지 예정 알림 템플릿 (월 15일)
- [ ] 정지 완료 알림 템플릿 (월 1일)
- [ ] 정지 해제 알림 템플릿
- [ ] SMS 템플릿 작성

### 테스트 ✅
- [ ] 단위 테스트 작성 (환불율, 매출 0)
- [ ] 통합 테스트 작성 (배치 실행)
- [ ] E2E 테스트 시나리오 3개 수동 검증

### 운영 ✅
- [ ] 관리자 SOP 문서 작성
- [ ] 파트너 안내 문서 작성
- [ ] 모니터링 대시보드 설정
- [ ] Slack 알람 설정 (선택)

### 코드 품질 ✅
- [ ] TypeScript 컴파일 오류 0개
- [ ] eslint 통과
- [ ] Prisma format 적용
- [ ] 주석 및 docstring 작성

### 배포 ✅
- [ ] Staging 환경에서 전체 테스트
- [ ] Vercel에 마이그레이션 적용
- [ ] 환경 변수 설정 (CRON_SECRET)
- [ ] vercel.json Cron 추가
- [ ] 프로덕션 배포 완료
- [ ] 첫 자동 실행 확인 (월 1일)

---

## 11. 참고사항

### 11.1 기존 코드와의 통합

```typescript
// 기존: Partner 모델에는 role 필드 없음
// 확인 필요: Partner.role이 있는지, 없으면 OrganizationMember에서 조회해야 함

// 기존: PartnerMetrics.revenue는 AffiliateSale.amount로 계산됨
// 확인 필요: AffiliateSale 테이블 스키마 (환불 필드명)
```

### 11.2 크루즈닷몰 연동 고려

```typescript
// 크루즈닷몰의 파트너 정지는 별도 처리
// CRM의 Organization.status와 동기화 필요 (웹훅 or API 호출)

// 미결정: CRM에서 정지 → 크루즈닷몰 자동 정지?
// vs 독립적으로 운영?
```

### 11.3 향후 개선

1. **머신러닝 활용**: 환불율 이상 탐지 자동화
2. **경고 시스템**: 정지 임박 시 파트너에게 early warning
3. **회복 지원**: 정지 파트너 성과 개선 프로그램 (코칭, 인센티브)
4. **자동 정지 해제**: 조건 충족 시 관리자 검토 없이 자동 해제

---

## 12. 용어 정의

| 용어 | 정의 |
|------|------|
| 환불율 | (환불액 / 전체 매출액) × 100 |
| 최근 3개월 | 현재 달 기준 지난 3개월 완전 기간 |
| 최근 5개월 | 현재 달 기준 지난 5개월 완전 기간 |
| SUSPENDED | 계약 정지 상태 (로그인 불가) |
| APPEALING | 이의 제기 상태 (관리자 검토 대기) |
| RESOLVED | 정지 해제 완료 상태 |
| 조건 OR | 환불율 ≥ 30% **또는** 매출 5개월 0 |

---

## 최종 요약

**구현 난이도**: 중상 (기술: 4/5, 운영: 3/5)

**예상 일정**: 2-3일 (20시간)

**리스크**: 
- 환불율 계산 오류 → 정지 대상 오식별
- 파트너 반발 → 이의 제기 대량 발생

**완화 방안**:
- 배치 전 dryRun 실행해서 결과 미리 보기
- 정지 이전 월 15일 경고 이메일 발송
- 이의 제기 접수 후 3일 내 결과 안내

---

**작업 시작 전에 위 설계에 대한 검토 및 승인 부탁드립니다.**
