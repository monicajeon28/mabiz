# 신뢰도 시스템 구현 가이드

**작성일**: 2026-06-19  
**난이도**: 중상 (1-2주)  
**팀 구성**: 2명 (백엔드 1 + 풀스택 1)

---

## 📋 구현 순서 (6 Phase)

### Phase 1: Prisma 스키마 (30분)
### Phase 2: 핵심 API (6개 구현) (3일)
### Phase 3: 자동 트리거 (1일)
### Phase 4: UI 연결 (2일)
### Phase 5: 테스트 (1일)
### Phase 6: 배포 (1일)

---

## Phase 1: Prisma 스키마 (30분)

### Step 1-1: prisma/schema.prisma 에 모델 추가

```prisma
// 신뢰도 점수
model TrustScore {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // 환불 통계
  totalSales      Int       @default(0)
  totalRefunds    Int       @default(0)
  refundRate      Float     @default(0)
  
  // 신뢰도 점수
  trustScore      Int       @default(100)
  status          String    @default("GOOD")
  
  // 임계값 추적
  nextThreshold   Int       @default(35)
  warningCount    Int       @default(0)
  
  // 타임스탬프
  lastCalculatedAt DateTime  @updatedAt
  statusChangedAt DateTime?
  
  // 관계
  appeals         TrustAppeal[]
  auditLogs       TrustAuditLog[]
  
  @@index([userId])
  @@index([status])
}

// 이의 제기
model TrustAppeal {
  id              String    @id @default(cuid())
  trustScoreId    String
  trustScore      TrustScore @relation(fields: [trustScoreId], references: [id], onDelete: Cascade)
  
  reason          String
  evidenceUrls    String[]  @default([])
  
  status          String    @default("PENDING")
  adminReview     String?
  
  requestedAction String?
  appliedAction   String?
  
  createdAt       DateTime  @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?
  
  @@index([status])
  @@index([trustScoreId])
}

// 감사 로그
model TrustAuditLog {
  id              String    @id @default(cuid())
  userId          String
  
  eventType       String
  previousValue   Json?
  newValue        Json?
  description     String
  triggeredBy     String?
  
  createdAt       DateTime  @default(now())
  
  @@index([userId])
  @@index([eventType])
}
```

### Step 1-2: Prisma 마이그레이션

```bash
# 마이그레이션 생성
npx prisma migrate dev --name add_trust_score

# 타입 재생성
npx prisma generate
```

### Step 1-3: User 모델에 관계 추가

```prisma
model User {
  // ... 기존 필드
  
  // 신뢰도
  trustScore      TrustScore?
  
  // ... 기존 관계
}
```

---

## Phase 2: 핵심 API 6개 (3일)

### Step 2-1: 유틸리티 함수 (lib/trust-score.ts)

```typescript
// src/lib/trust-score.ts

import { prisma } from '@/lib/prisma';
import {
  TrustStatus,
  TrustScoreCalculation,
  TRUST_SCORE_THRESHOLDS,
} from '@/types/trust-score';

/**
 * 신뢰도 상태 결정
 * @param refundRate 환불율 (0-100)
 * @returns 상태 (GOOD/WARNING/RESTRICTED/SUSPENDED)
 */
export function determineStatus(refundRate: number): TrustStatus {
  if (refundRate < 30) return 'GOOD';
  if (refundRate < 35) return 'WARNING';
  if (refundRate < 40) return 'RESTRICTED';
  return 'SUSPENDED';
}

/**
 * 신뢰도 점수 계산
 * @param userId 사용자 ID
 * @returns 계산된 신뢰도 정보
 */
export async function calculateTrustScore(
  userId: string
): Promise<TrustScoreCalculation> {
  // 1. 모든 거래 조회
  const refunds = await prisma.settlement.count({
    where: {
      partnerId: userId,
      status: 'REFUNDED',
    },
  });

  const sales = await prisma.settlement.count({
    where: {
      partnerId: userId,
    },
  });

  // 2. 환불율 계산
  const refundRate = sales > 0 ? (refunds / sales) * 100 : 0;

  // 3. 신뢰도 점수
  const trustScore = Math.max(0, Math.min(100, 100 - refundRate));

  // 4. 상태 결정
  const status = determineStatus(refundRate);

  // 5. 다음 임계값 계산
  let nextThreshold = 35;
  if (status === 'GOOD') nextThreshold = 30;
  else if (status === 'WARNING') nextThreshold = 35;
  else if (status === 'RESTRICTED') nextThreshold = 40;
  else nextThreshold = 100;

  return {
    totalSales: sales,
    totalRefunds: refunds,
    refundRate: Math.round(refundRate * 100) / 100,
    trustScore: Math.round(trustScore),
    status,
    nextThreshold,
  };
}

/**
 * 신뢰도 저장 및 상태 변경 감지
 */
export async function updateTrustScore(
  userId: string,
  calculation: TrustScoreCalculation
) {
  const existing = await prisma.trustScore.findUnique({
    where: { userId },
  });

  const previousStatus = existing?.status as TrustStatus | undefined;
  const statusChanged = previousStatus && previousStatus !== calculation.status;

  // 신뢰도 저장
  const updated = await prisma.trustScore.upsert({
    where: { userId },
    update: {
      totalSales: calculation.totalSales,
      totalRefunds: calculation.totalRefunds,
      refundRate: calculation.refundRate,
      trustScore: calculation.trustScore,
      status: calculation.status,
      nextThreshold: calculation.nextThreshold,
      lastCalculatedAt: new Date(),
      ...(statusChanged && { statusChangedAt: new Date() }),
    },
    create: {
      userId,
      totalSales: calculation.totalSales,
      totalRefunds: calculation.totalRefunds,
      refundRate: calculation.refundRate,
      trustScore: calculation.trustScore,
      status: calculation.status,
      nextThreshold: calculation.nextThreshold,
    },
  });

  // 상태 변경 로그 기록
  if (statusChanged) {
    await prisma.trustAuditLog.create({
      data: {
        userId,
        eventType: 'STATUS_CHANGE',
        description: `상태 변경: ${previousStatus} → ${calculation.status}`,
        previousValue: { status: previousStatus },
        newValue: { status: calculation.status },
        triggeredBy: 'system',
      },
    });
  }

  return { updated, statusChanged, previousStatus };
}

/**
 * 상태 관련 액세스 권한 확인
 */
export function getAccessPermissions(status: TrustStatus) {
  return {
    canSell: status !== 'SUSPENDED',
    canRegisterProduct: status !== 'RESTRICTED' && status !== 'SUSPENDED',
    canLogin: status !== 'SUSPENDED',
  };
}
```

### Step 2-2: API 1 - 신뢰도 조회

```typescript
// src/app/api/trust-score/[userId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRole } from '@/api/_auth/validate-admin-role';
import {
  GetTrustScoreResponse,
  TRUST_SCORE_MESSAGES,
} from '@/types/trust-score';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const session = await validateAdminRole(request);

    // 관리자: 누구든 조회 가능
    // 사용자: 자신만 조회 가능
    if (
      session.role !== 'ADMIN' &&
      session.user.id !== userId
    ) {
      return NextResponse.json(
        { error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 신뢰도 조회
    const trustScore = await prisma.trustScore.findUnique({
      where: { userId },
    });

    if (!trustScore) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const response: GetTrustScoreResponse = {
      id: trustScore.id,
      userId: trustScore.userId,
      refundRate: trustScore.refundRate,
      trustScore: trustScore.trustScore,
      status: trustScore.status as any,
      nextThreshold: trustScore.nextThreshold,
      warningCount: trustScore.warningCount,
      message: TRUST_SCORE_MESSAGES[trustScore.status as any],
      lastCalculatedAt: trustScore.lastCalculatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('신뢰도 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
```

### Step 2-3: API 2 - 신뢰도 계산

```typescript
// src/app/api/trust-score/[userId]/calculate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRole } from '@/api/_auth/validate-admin-role';
import { calculateTrustScore, updateTrustScore } from '@/lib/trust-score';

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const session = await validateAdminRole(request);
    const body = await request.json();

    if (session.role !== 'ADMIN' && session.user.id !== userId) {
      return NextResponse.json(
        { error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 신뢰도 계산
    const calculation = await calculateTrustScore(userId);

    // 신뢰도 저장 및 상태 변경 감지
    const { updated, statusChanged, previousStatus } = await updateTrustScore(
      userId,
      calculation
    );

    return NextResponse.json({
      id: updated.id,
      userId: updated.userId,
      refundRate: updated.refundRate,
      trustScore: updated.trustScore,
      status: updated.status,
      nextThreshold: updated.nextThreshold,
      message: TRUST_SCORE_MESSAGES[updated.status as any],
      statusChanged,
      previousStatus,
      notification: statusChanged
        ? {
            type: calculation.status === 'SUSPENDED' ? 'CRITICAL' : 'WARNING',
            message: `상태 변경: ${previousStatus} → ${calculation.status}`,
          }
        : undefined,
    });
  } catch (error) {
    console.error('신뢰도 계산 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
```

### Step 2-4: API 3 - 상태 변경 (관리자만)

```typescript
// src/app/api/trust-score/[userId]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRole } from '@/api/_auth/validate-admin-role';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const session = await validateAdminRole(request);

    // 관리자만 가능
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자만 사용 가능합니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, reason, note } = body;

    // 유효한 상태 확인
    const validStatuses = ['GOOD', 'WARNING', 'RESTRICTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다' },
        { status: 400 }
      );
    }

    // 신뢰도 업데이트
    const updated = await prisma.trustScore.update({
      where: { userId },
      data: {
        status,
        statusChangedAt: new Date(),
      },
    });

    // 감사 로그
    await prisma.trustAuditLog.create({
      data: {
        userId,
        eventType: 'ADMIN_ACTION',
        description: `관리자가 상태를 변경: ${status} (${reason})`,
        newValue: { status, reason, note },
        triggeredBy: session.user.id,
      },
    });

    return NextResponse.json({
      id: updated.id,
      userId: updated.userId,
      status: updated.status,
      reason,
      changedAt: new Date().toISOString(),
      changedBy: session.user.id,
    });
  } catch (error) {
    console.error('상태 변경 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
```

### Step 2-5: API 4 - 이의 제기

```typescript
// src/app/api/trust-score/[userId]/appeal/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const body = await request.json();
    const { reason, evidenceUrls, requestedAction } = body;

    // 신뢰도 조회
    const trustScore = await prisma.trustScore.findUnique({
      where: { userId },
    });

    if (!trustScore) {
      return NextResponse.json(
        { error: '신뢰도 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 이의 제기 생성
    const appeal = await prisma.trustAppeal.create({
      data: {
        trustScoreId: trustScore.id,
        reason,
        evidenceUrls: evidenceUrls || [],
        requestedAction,
        status: 'PENDING',
      },
    });

    // 감사 로그
    await prisma.trustAuditLog.create({
      data: {
        userId,
        eventType: 'APPEAL',
        description: `이의 제기: ${reason}`,
        newValue: { appealId: appeal.id },
        triggeredBy: userId,
      },
    });

    return NextResponse.json(
      {
        id: appeal.id,
        userId,
        trustScoreId: trustScore.id,
        status: appeal.status,
        reason: appeal.reason,
        evidenceCount: appeal.evidenceUrls.length,
        requestedAction: appeal.requestedAction,
        createdAt: appeal.createdAt.toISOString(),
        message:
          '이의 제기가 접수되었습니다. 관리자가 검토 후 연락드리겠습니다.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('이의 제기 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
```

### Step 2-6: API 5 - 이의 검토

```typescript
// src/app/api/trust-score/appeal/[appealId]/review/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRole } from '@/api/_auth/validate-admin-role';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { appealId: string } }
) {
  try {
    const appealId = params.appealId;
    const session = await validateAdminRole(request);

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자만 사용 가능합니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, adminReview, appliedAction } = body;

    // 이의 제기 조회
    const appeal = await prisma.trustAppeal.findUnique({
      where: { id: appealId },
      include: { trustScore: true },
    });

    if (!appeal) {
      return NextResponse.json(
        { error: '이의 제기를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 이의 제기 업데이트
    const updated = await prisma.trustAppeal.update({
      where: { id: appealId },
      data: {
        status,
        adminReview,
        appliedAction,
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
      },
    });

    let result;

    // 승인 시 신뢰도 재계산
    if (status === 'APPROVED' && appliedAction === 'RESTORE') {
      const previousScore = appeal.trustScore.trustScore;
      const previousRate = appeal.trustScore.refundRate;

      // 환불 1건만 제거하여 재계산
      const newTrustScore = Math.min(100, previousScore + 1);
      const newRefundRate = Math.max(0, previousRate - 1);

      await prisma.trustScore.update({
        where: { id: appeal.trustScoreId },
        data: {
          trustScore: newTrustScore,
          refundRate: newRefundRate,
        },
      });

      result = {
        trustScoreUpdated: true,
        previousScore,
        newScore: newTrustScore,
        previousRefundRate: previousRate,
        newRefundRate,
      };
    } else {
      result = { trustScoreUpdated: false };
    }

    // 감사 로그
    const eventType = status === 'APPROVED' ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED';
    await prisma.trustAuditLog.create({
      data: {
        userId: appeal.trustScore.userId,
        eventType: eventType as any,
        description: `이의 제기 ${status}: ${appeal.reason}`,
        newValue: { appealStatus: status, appliedAction },
        triggeredBy: session.user.id,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      adminReview: updated.adminReview,
      appliedAction: updated.appliedAction,
      reviewedAt: updated.reviewedAt?.toISOString(),
      reviewedBy: updated.reviewedBy,
      result,
    });
  } catch (error) {
    console.error('이의 검토 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
```

### Step 2-7: API 6 - 감사 로그 조회

```typescript
// src/app/api/trust-score/[userId]/audit-logs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRole } from '@/api/_auth/validate-admin-role';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const session = await validateAdminRole(request);

    // 권한 확인
    if (
      session.role !== 'ADMIN' &&
      session.user.id !== userId
    ) {
      return NextResponse.json(
        { error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
    const eventType = request.nextUrl.searchParams.get('eventType') || undefined;

    // 로그 조회
    const logs = await prisma.trustAuditLog.findMany({
      where: {
        userId,
        ...(eventType && { eventType }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.trustAuditLog.count({
      where: {
        userId,
        ...(eventType && { eventType }),
      },
    });

    return NextResponse.json({
      total,
      logs: logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        description: log.description,
        previousValue: log.previousValue,
        newValue: log.newValue,
        triggeredBy: log.triggeredBy,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('감사 로그 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
```

---

## Phase 3: 자동 트리거 (1일)

### Step 3-1: 환불 처리 후 자동 계산

```typescript
// src/app/api/settlements/[id]/refund/route.ts (기존 파일 수정)

import { calculateTrustScore, updateTrustScore } from '@/lib/trust-score';

export async function POST(request: NextRequest) {
  // ... 기존 환불 처리 코드

  // 환불 저장 후
  await prisma.settlement.update({
    where: { id: settlementId },
    data: { status: 'REFUNDED' },
  });

  // 🆕 신뢰도 자동 계산
  const calculation = await calculateTrustScore(partnerId);
  await updateTrustScore(partnerId, calculation);

  // ... 나머지 코드
}
```

### Step 3-2: 일일 정시 신뢰도 재계산

```typescript
// src/app/api/cron/daily-trust-score-calculation.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(request, response) {
  // Cron 검증
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: '무단 접근' });
  }

  try {
    console.log('[신뢰도] 일일 재계산 시작');

    // 모든 사용자의 신뢰도 조회
    const trustScores = await prisma.trustScore.findMany();

    let updated = 0;
    let statusChanged = 0;

    for (const trust of trustScores) {
      // 환불율 재계산
      const refunds = await prisma.settlement.count({
        where: { partnerId: trust.userId, status: 'REFUNDED' },
      });

      const sales = await prisma.settlement.count({
        where: { partnerId: trust.userId },
      });

      const newRefundRate = sales > 0 ? (refunds / sales) * 100 : 0;

      // 상태 변경 감지
      let newStatus = 'GOOD';
      if (newRefundRate < 30) newStatus = 'GOOD';
      else if (newRefundRate < 35) newStatus = 'WARNING';
      else if (newRefundRate < 40) newStatus = 'RESTRICTED';
      else newStatus = 'SUSPENDED';

      const changed = newStatus !== trust.status;

      // 업데이트
      await prisma.trustScore.update({
        where: { id: trust.id },
        data: {
          totalRefunds: refunds,
          totalSales: sales,
          refundRate: newRefundRate,
          status: newStatus,
          ...(changed && { statusChangedAt: new Date() }),
        },
      });

      if (changed) {
        statusChanged++;

        // 상태 변경 로그
        await prisma.trustAuditLog.create({
          data: {
            userId: trust.userId,
            eventType: 'STATUS_CHANGE',
            description: `일일 재계산: ${trust.status} → ${newStatus}`,
            previousValue: { status: trust.status },
            newValue: { status: newStatus },
            triggeredBy: 'system',
          },
        });
      }

      updated++;
    }

    console.log(`[신뢰도] 완료: ${updated}명 업데이트, ${statusChanged}명 상태 변경`);

    return response.json({
      success: true,
      updated,
      statusChanged,
    });
  } catch (error) {
    console.error('[신뢰도] 오류:', error);
    return response.status(500).json({ error: '서버 오류' });
  } finally {
    await prisma.$disconnect();
  }
}
```

### Step 3-3: Vercel Cron 등록

```json
// vercel.json 에 추가
{
  "crons": [
    {
      "path": "/api/cron/daily-trust-score-calculation",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## Phase 4: UI 연결 (2일)

### Step 4-1: 대시보드 신뢰도 카드

```typescript
// src/app/(dashboard)/dashboard/components/TrustScoreCard.tsx

'use client';

import { useEffect, useState } from 'react';
import { TrustStatus } from '@/types/trust-score';

interface TrustScoreDisplay {
  score: number;
  status: TrustStatus;
  message: string;
  color: 'green' | 'yellow' | 'red' | 'dark';
}

export function TrustScoreCard({ userId }: { userId: string }) {
  const [data, setData] = useState<TrustScoreDisplay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrustScore() {
      try {
        const res = await fetch(`/api/trust-score/${userId}`);
        const result = await res.json();

        const colorMap: Record<TrustStatus, 'green' | 'yellow' | 'red' | 'dark'> = {
          GOOD: 'green',
          WARNING: 'yellow',
          RESTRICTED: 'red',
          SUSPENDED: 'dark',
        };

        setData({
          score: result.trustScore,
          status: result.status,
          message: result.message,
          color: colorMap[result.status],
        });
      } catch (error) {
        console.error('신뢰도 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrustScore();
  }, [userId]);

  if (loading) return <div>로딩 중...</div>;
  if (!data) return <div>신뢰도를 불러올 수 없습니다</div>;

  const bgColorMap = {
    green: 'bg-green-50',
    yellow: 'bg-yellow-50',
    red: 'bg-red-50',
    dark: 'bg-gray-50',
  };

  const textColorMap = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    dark: 'text-gray-600',
  };

  return (
    <div className={`p-6 rounded-lg ${bgColorMap[data.color]}`}>
      <h3 className="text-18px font-bold mb-4">신뢰도</h3>

      <div className="flex items-center gap-4">
        <div className="text-48px font-bold">
          <span className={textColorMap[data.color]}>{data.score}</span>
          <span className="text-16px">점</span>
        </div>

        <div className="flex-1">
          <p className={`text-16px font-bold ${textColorMap[data.color]}`}>
            {data.status}
          </p>
          <p className="text-14px text-gray-600 mt-2">
            {data.message}
          </p>
        </div>
      </div>

      <button className="mt-4 w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-16px">
        자세히 보기
      </button>
    </div>
  );
}
```

### Step 4-2: 신뢰도 상세 페이지

```typescript
// src/app/(dashboard)/settings/trust-score/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { TrustScore, TrustAuditLog } from '@/types/trust-score';

export default function TrustScorePage() {
  const [trust, setTrust] = useState<TrustScore | null>(null);
  const [logs, setLogs] = useState<TrustAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch데이터() {
      try {
        // 신뢰도 조회
        const trustRes = await fetch(`/api/trust-score/${userId}`);
        const trustData = await trustRes.json();
        setTrust(trustData);

        // 로그 조회
        const logsRes = await fetch(
          `/api/trust-score/${userId}/audit-logs?limit=20`
        );
        const logsData = await logsRes.json();
        setLogs(logsData.logs);
      } catch (error) {
        console.error('데이터 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    }

    fetch데이터();
  }, []);

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="p-6">
      <h1 className="text-20px font-bold mb-6">신뢰도 관리</h1>

      {/* 신뢰도 요약 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded-lg">
          <p className="text-14px text-gray-600">신뢰도 점수</p>
          <p className="text-24px font-bold">{trust?.trustScore}점</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-14px text-gray-600">환불율</p>
          <p className="text-24px font-bold">{trust?.refundRate}%</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-14px text-gray-600">상태</p>
          <p className="text-24px font-bold">{trust?.status}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-14px text-gray-600">다음 임계값</p>
          <p className="text-24px font-bold">{trust?.nextThreshold}%</p>
        </div>
      </div>

      {/* 로그 */}
      <div>
        <h2 className="text-16px font-bold mb-4">최근 활동</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3 text-14px">날짜</th>
              <th className="text-left p-3 text-14px">유형</th>
              <th className="text-left p-3 text-14px">설명</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b">
                <td className="p-3 text-14px">
                  {new Date(log.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="p-3 text-14px">{log.eventType}</td>
                <td className="p-3 text-14px">{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Phase 5: 테스트 (1일)

### 통합 테스트

```typescript
// src/app/api/__tests__/trust-score.test.ts

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('신뢰도 시스템 API', () => {
  let userId = 'test_user_' + Date.now();

  beforeAll(async () => {
    // 테스트 사용자 생성
  });

  afterAll(async () => {
    // 테스트 데이터 정리
  });

  it('API 1: 신뢰도 조회', async () => {
    const res = await fetch(`/api/trust-score/${userId}`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('trustScore');
    expect(data).toHaveProperty('status');
  });

  it('API 2: 신뢰도 계산', async () => {
    const res = await fetch(
      `/api/trust-score/${userId}/calculate`,
      { method: 'POST' }
    );
    expect(res.status).toBe(200);
  });

  it('API 4: 이의 제기', async () => {
    const res = await fetch(
      `/api/trust-score/${userId}/appeal`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'PRODUCT_DEFECT',
          evidenceUrls: ['https://example.com'],
        }),
      }
    );
    expect(res.status).toBe(201);
  });

  it('API 6: 감사 로그 조회', async () => {
    const res = await fetch(
      `/api/trust-score/${userId}/audit-logs`
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('logs');
  });
});
```

---

## Phase 6: 배포 (1일)

### 배포 체크리스트

```bash
# 1. 타입 확인
npx tsc --noEmit

# 2. 테스트 실행
npm test -- trust-score

# 3. Prisma 마이그레이션 확인
npx prisma migrate status

# 4. 로컬 테스트
npm run dev

# 5. Cron 설정 확인
# vercel.json 체크

# 6. 배포
npx vercel --prod
```

---

## 문제 해결

### Q: 신뢰도가 계산되지 않아요
A: 
1. Settlement 테이블 확인: `status = 'REFUNDED'` 레코드 있는지
2. API 2 호출해서 수동 계산: `POST /api/trust-score/{userId}/calculate`
3. 로그 확인: `TrustAuditLog` 테이블 확인

### Q: 상태가 변경 안 돼요
A:
1. 환불율 확인: 환불율이 임계값을 넘었는지
2. 수동 상태 변경: `PATCH /api/trust-score/{userId}/status` (관리자)

### Q: 이의 제기가 승인되지 않아요
A:
1. TrustAppeal 테이블 확인: status = 'PENDING'
2. API 5로 수동 승인: `PATCH /api/trust-score/appeal/{appealId}/review`

---

**다음**: Phase 1 (Prisma 스키마) 구현 시작!
