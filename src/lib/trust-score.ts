/**
 * 신뢰도 점수 계산 엔진
 * @see docs/TRUST_SCORE_API_SPEC.md
 */

import {
  TrustStatus,
  TrustScoreCalculation,
  TRUST_SCORE_THRESHOLDS,
  TRUST_SCORE_MESSAGES,
} from '@/types/trust-score';
import prisma from '@/lib/prisma';

// Prisma 타입 확장 (마이그레이션 전)
const getTrustScorePrisma = () => (prisma as any).trustScore;
const getTrustAppealPrisma = () => (prisma as any).trustAppeal;
const getTrustAuditLogPrisma = () => (prisma as any).trustAuditLog;

/**
 * 신뢰도 점수 및 상태 계산
 * 공식: trustScore = 100 - refundRate
 */
export function calculateTrustScore(
  totalSales: number,
  totalRefunds: number
): TrustScoreCalculation {
  // 예외 처리
  if (totalSales === 0) {
    return {
      totalSales: 0,
      totalRefunds: 0,
      refundRate: 0,
      trustScore: 100,
      status: 'GOOD',
      nextThreshold: 30,
    };
  }

  // 환불율 계산 (%)
  const refundRate = (totalRefunds / totalSales) * 100;

  // 신뢰도 점수 계산
  const trustScore = Math.max(0, 100 - Math.round(refundRate * 10) / 10);

  // 상태 결정
  const status = determineStatus(refundRate);

  // 다음 임계값 계산
  const nextThreshold = getNextThreshold(status);

  return {
    totalSales,
    totalRefunds,
    refundRate: Math.round(refundRate * 10) / 10, // 소수점 1자리
    trustScore,
    status,
    nextThreshold,
  };
}

/**
 * 환불율에 따른 상태 결정
 */
export function determineStatus(refundRate: number): TrustStatus {
  if (refundRate < 30) return 'GOOD';
  if (refundRate < 35) return 'WARNING';
  if (refundRate < 40) return 'RESTRICTED';
  return 'SUSPENDED';
}

/**
 * 다음 임계값 계산
 */
export function getNextThreshold(status: TrustStatus): number {
  const thresholds = {
    GOOD: 30,
    WARNING: 35,
    RESTRICTED: 40,
    SUSPENDED: 40,
  };
  return thresholds[status];
}

/**
 * 상태별 사용자 메시지
 */
export function getStatusMessage(status: TrustStatus): string {
  return TRUST_SCORE_MESSAGES[status];
}

/**
 * 상태별 접근 권한
 */
export function getAccessPermissions(status: TrustStatus) {
  return {
    canLogin: status !== 'SUSPENDED',
    canSell: status !== 'SUSPENDED',
    canRegisterProduct: status === 'GOOD' || status === 'WARNING',
    canModifySettings: status !== 'SUSPENDED',
  };
}

/**
 * 신뢰도 재계산 및 저장
 * @param userId - 사용자 ID
 * @returns 계산 결과 + 상태 변경 여부
 */
export async function recalculateTrustScore(userId: string) {
  try {
    // 1. 기존 신뢰도 조회
    const existing = await getTrustScorePrisma().findUnique({
      where: { userId },
    });

    // 2. Settlement에서 판매 및 환불 건수 조회
    // (실제 구현 시 Settlement 쿼리 필요)
    // 임시로 기존 값 사용
    const totalSales = existing?.totalSales ?? 0;
    const totalRefunds = existing?.totalRefunds ?? 0;

    // 3. 신뢰도 계산
    const calculation = calculateTrustScore(totalSales, totalRefunds);

    // 4. 상태 변경 여부 확인
    const previousStatus = existing?.status;
    const statusChanged = previousStatus && previousStatus !== calculation.status;

    // 5. DB 업데이트
    const updated = await getTrustScorePrisma().upsert({
      where: { userId },
      create: {
        userId,
        ...calculation,
      },
      update: {
        ...calculation,
        statusChangedAt: statusChanged ? new Date() : undefined,
      },
    });

    // 6. 상태 변경 시 감사 로그 기록
    if (statusChanged && previousStatus) {
      await createAuditLog({
        userId,
        eventType: 'STATUS_CHANGE',
        description: `상태 변경됨: ${previousStatus} → ${calculation.status}`,
        previousValue: {
          status: previousStatus,
          refundRate: existing?.refundRate,
          trustScore: existing?.trustScore,
        },
        newValue: {
          status: calculation.status,
          refundRate: calculation.refundRate,
          trustScore: calculation.trustScore,
        },
        triggeredBy: 'system',
      });
    }

    return {
      ...updated,
      statusChanged,
      previousStatus,
    };
  } catch (error) {
    console.error(`[TrustScore] 재계산 실패: ${userId}`, error);
    throw error;
  }
}

/**
 * 감사 로그 생성
 */
export async function createAuditLog(data: {
  userId: string;
  eventType: string;
  description: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  triggeredBy?: string | null;
  trustScoreId?: string | null;
}) {
  try {
    return await getTrustAuditLogPrisma().create({
      data: {
        userId: data.userId,
        eventType: data.eventType,
        description: data.description,
        previousValue: data.previousValue,
        newValue: data.newValue,
        triggeredBy: data.triggeredBy || 'system',
        trustScoreId: data.trustScoreId,
      },
    });
  } catch (error) {
    console.error('[TrustScore] 로그 생성 실패:', error);
    throw error;
  }
}

/**
 * 신뢰도 조회 (권한 확인)
 */
export async function getTrustScore(userId: string, requesterId?: string) {
  const trust = await getTrustScorePrisma().findUnique({
    where: { userId },
  });

  if (!trust) {
    return null;
  }

  // 권한 확인: 본인 또는 관리자만 조회 가능
  if (requesterId && requesterId !== userId) {
    // 관리자 권한 확인은 별도 미들웨어에서 처리
  }

  return {
    ...trust,
    message: getStatusMessage(trust.status as TrustStatus),
    permissions: getAccessPermissions(trust.status as TrustStatus),
  };
}

/**
 * 모든 사용자 신뢰도 재계산 (일일 배치)
 */
export async function recalculateAllTrustScores() {
  const startTime = Date.now();
  let updateCount = 0;
  let changeCount = 0;

  try {
    // 모든 신뢰도 조회
    const allTrustScores = await getTrustScorePrisma().findMany();

    for (const trust of allTrustScores) {
      const result = await recalculateTrustScore(trust.userId);
      updateCount++;
      if (result.statusChanged) {
        changeCount++;
      }
    }

    const duration = Date.now() - startTime;
    const message = `[TrustScore] 일일 재계산 완료: ${updateCount}명 업데이트, ${changeCount}명 상태 변경 (${duration}ms)`;

    console.log(message);

    return {
      success: true,
      updateCount,
      changeCount,
      duration,
      message,
    };
  } catch (error) {
    console.error('[TrustScore] 일일 재계산 실패:', error);
    throw error;
  }
}

/**
 * 이의 제기 승인 후 신뢰도 복구
 * @param appealId - 이의 제기 ID
 * @param trustScoreAdjustment - 신뢰도 조정값 (기본값: -1 = 환불 1건 제거)
 */
export async function applyAppealApproval(
  appealId: string,
  trustScoreAdjustment: number = -1
) {
  try {
    // 1. 이의 조회
    const appeal = await getTrustAppealPrisma().findUnique({
      where: { id: appealId },
      include: { trustScore: true },
    });

    if (!appeal) {
      throw new Error('이의를 찾을 수 없습니다');
    }

    const userId = appeal.trustScore.userId;
    const previousRefunds = appeal.trustScore.totalRefunds;
    const newRefunds = Math.max(0, previousRefunds + trustScoreAdjustment); // -1이면 환불 1건 제거

    // 2. 신뢰도 재계산
    const newCalculation = calculateTrustScore(
      appeal.trustScore.totalSales,
      newRefunds
    );

    // 3. DB 업데이트
    const updated = await getTrustScorePrisma().update({
      where: { userId },
      data: {
        totalRefunds: newRefunds,
        refundRate: newCalculation.refundRate,
        trustScore: newCalculation.trustScore,
        status: newCalculation.status,
        nextThreshold: newCalculation.nextThreshold,
      },
    });

    // 4. 감사 로그 기록
    await createAuditLog({
      userId,
      trustScoreId: appeal.trustScoreId,
      eventType: 'APPEAL_APPROVED',
      description: `이의 제기 승인됨 (${appeal.reason})`,
      previousValue: {
        totalRefunds: previousRefunds,
        refundRate: appeal.trustScore.refundRate,
        trustScore: appeal.trustScore.trustScore,
      },
      newValue: {
        totalRefunds: newRefunds,
        refundRate: newCalculation.refundRate,
        trustScore: newCalculation.trustScore,
      },
      triggeredBy: 'admin',
    });

    return {
      success: true,
      userId,
      previousScore: appeal.trustScore.trustScore,
      newScore: updated.trustScore,
      previousRefundRate: appeal.trustScore.refundRate,
      newRefundRate: updated.refundRate,
    };
  } catch (error) {
    console.error(`[TrustScore] 이의 승인 실패: ${appealId}`, error);
    throw error;
  }
}
