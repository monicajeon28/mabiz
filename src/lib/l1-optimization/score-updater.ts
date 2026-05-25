/**
 * L1 렌즈: 최적화 점수 업데이트
 *
 * Contact별 L1OptimizationScore를 실시간으로 업데이트합니다.
 * 이의 시도 횟수, 성공률, 최적 변형 등을 추적합니다.
 */

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

type ObjectiveType = 'PRICE_HIGH' | 'PAYMENT_TERMS' | 'ROI_DOUBT' | 'COMPETITOR_COMPARE' | 'AFFORD_DOUBT';

/**
 * Contact의 L1 최적화 점수 업데이트
 */
export async function updateL1OptimizationScore(
  organizationId: string,
  contactId: string,
  objectiveType: ObjectiveType
): Promise<void> {
  try {
    // 1. 해당 Contact의 L1OptimizationScore 조회
    let score = await prisma.l1OptimizationScore.findUnique({
      where: { organizationId_contactId: { organizationId, contactId } },
    });

    if (!score) {
      // 신규 생성
      score = await prisma.l1OptimizationScore.create({
        data: {
          organizationId,
          contactId,
          currentScore: calculatePriceScore(objectiveType), // 초기 점수
          objectiveTypes: [objectiveType],
          totalAttempts: 0,
          successCount: 0,
          successRate: 0,
        },
      });
    } else {
      // 기존 점수 업데이트
      const newObjectiveTypes = Array.from(
        new Set([...score.objectiveTypes, objectiveType])
      );

      score = await prisma.l1OptimizationScore.update({
        where: { id: score.id },
        data: {
          objectiveTypes: newObjectiveTypes,
          lastAttemptAt: new Date(),
        },
      });
    }

    // 2. 최근 이의 기록 조회
    const recentAttempts = await prisma.l1PriceObjectionAttempt.findMany({
      where: {
        organizationId,
        contactId,
      },
      orderBy: { sentAt: 'desc' },
      take: 10, // 최근 10건
    });

    // 3. 성공률 재계산
    const totalAttempts = recentAttempts.length;
    const successCount = recentAttempts.filter(a => a.conversionResult).length;
    const successRate = totalAttempts > 0 ? (successCount / totalAttempts) : 0;

    // 4. 다음 재시도 날짜 계산 (실패한 이의는 7일 후 재접근)
    const lastAttempt = recentAttempts[0];
    let nextRetryAt = null;
    if (lastAttempt && !lastAttempt.conversionResult) {
      nextRetryAt = new Date(lastAttempt.sentAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    // 5. 최적 변형 결정 (성공 변형 기록)
    const successAttempts = recentAttempts.filter(a => a.conversionResult);
    let bestVariant = score.bestVariant;
    if (successAttempts.length > 0) {
      // 성공한 시도에서 가장 빈번한 변형 (A 또는 B)
      const variantCounts: Record<string, number> = {};
      successAttempts.forEach(a => {
        variantCounts[a.smsVariant] = (variantCounts[a.smsVariant] || 0) + 1;
      });
      bestVariant = Object.entries(variantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'A';
    }

    // 6. L1OptimizationScore 최종 업데이트
    await prisma.l1OptimizationScore.update({
      where: { id: score.id },
      data: {
        currentScore: calculatePriceScore(objectiveType, recentAttempts),
        totalAttempts,
        successCount,
        successRate,
        bestVariant,
        nextRetryAt,
        lastUpdated: new Date(),
      },
    });

    logger.info(`[L1] Optimization score updated`, {
      contactId,
      totalAttempts,
      successRate: Math.round(successRate * 100),
      bestVariant,
    });
  } catch (error) {
    logger.error('[L1] updateL1OptimizationScore error', error);
  }
}

/**
 * 가격 민감도 점수 계산 (0-100)
 *
 * 점수가 높을수록 가격에 민감함
 * - 이의 횟수: +5 per attempt
 * - 성공하지 못한 시도: +10 per failed
 * - 객체 유형별 가중치
 *   - PRICE_HIGH: +20
 *   - PAYMENT_TERMS: +15
 *   - ROI_DOUBT: +10
 *   - COMPETITOR_COMPARE: +8
 *   - AFFORD_DOUBT: +25 (가장 위험)
 */
function calculatePriceScore(
  objectiveType: ObjectiveType,
  attempts?: Array<{ conversionResult: boolean }>
): number {
  let score = 0;

  // 기본 객체 유형별 점수
  const typeScores: Record<ObjectiveType, number> = {
    PRICE_HIGH: 20,
    PAYMENT_TERMS: 15,
    ROI_DOUBT: 10,
    COMPETITOR_COMPARE: 8,
    AFFORD_DOUBT: 25,
  };

  score += typeScores[objectiveType];

  // 시도 횟수 반영 (있을 경우)
  if (attempts && attempts.length > 0) {
    const failedCount = attempts.filter(a => !a.conversionResult).length;
    score += attempts.length * 5; // 재시도 (+5 per attempt)
    score += failedCount * 10; // 실패 패널티 (+10 per failed)
  }

  // 점수 상한선: 100
  return Math.min(100, score);
}

/**
 * 대량 점수 업데이트 (batch)
 */
export async function updateL1OptimizationScoreBatch(
  entries: Array<{
    organizationId: string;
    contactId: string;
    objectiveType: ObjectiveType;
  }>
): Promise<void> {
  await Promise.all(
    entries.map(entry =>
      updateL1OptimizationScore(entry.organizationId, entry.contactId, entry.objectiveType)
    )
  );
}

/**
 * Contact의 점수 히스토리 조회
 */
export async function getL1OptimizationScoreHistory(
  organizationId: string,
  contactId: string
): Promise<Array<{ date: string; score: number; reason: string }>> {
  const score = await prisma.l1OptimizationScore.findUnique({
    where: { organizationId_contactId: { organizationId, contactId } },
    select: { scoreHistory: true },
  });

  if (!score || !score.scoreHistory) {
    return [];
  }

  return score.scoreHistory as Array<{ date: string; score: number; reason: string }>;
}
