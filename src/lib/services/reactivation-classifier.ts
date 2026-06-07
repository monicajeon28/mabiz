/**
 * L0 Lens: 부재중 고객 재활성화 자동분류 규칙
 *
 * 부재중 고객을 다음 기준으로 자동 분류:
 * 1. reactivationSegment: "3-6m", "6-12m", "1y+" (lastCruiseDate 기반)
 * 2. reactivationLikelihood: 0-100 점수 (여러 신호 기반)
 *
 * Risk Score 계산:
 * - 높을수록 재예약 가능성이 높음 (VIP 고객, 높은 만족도, 최근 부재)
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface ReactivationClassification {
  segment: '3-6m' | '6-12m' | '1y+';
  likelihood: number; // 0-100
  score: number; // 0-100 (재예약 확률)
}

/**
 * 부재중 고객 자동 분류
 * @param organizationId - 조직 ID
 * @param options - 분류 옵션
 */
export async function classifyReactivationCustomers(
  organizationId: string,
  options: {
    daysInactive?: number; // 부재 기준 일수 (기본: 180일)
    batchSize?: number; // 배치 처리 크기 (기본: 100)
  } = {},
) {
  const { daysInactive = 180, batchSize = 100 } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  // 부재중 고객 조회 (6개월 이상 구매 없음)
  const inactiveCustomers = await prisma.contact.findMany({
    where: {
      organizationId,
      deletedAt: null,
      type: 'CUSTOMER', // LEAD 제외, 실제 구매자만
      purchasedAt: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      purchasedAt: true,
      lastCruiseDate: true,
      lastSatisfactionScore: true,
      cruiseCount: true,
      vipStatus: true,
      reEngageCount: true,
      lastContactedAt: true,
    },
  });

  logger.log(`Found ${inactiveCustomers.length} inactive customers for organization ${organizationId}`);

  // 배치 처리로 분류
  for (let i = 0; i < inactiveCustomers.length; i += batchSize) {
    const batch = inactiveCustomers.slice(i, i + batchSize);

    const updates = await Promise.all(
      batch.map(async (customer) => {
        const classification = calculateReactivationScore(customer);

        return prisma.contact.update({
          where: { id: customer.id },
          data: {
            reactivationSegment: classification.segment,
            reactivationLikelihood: classification.likelihood,
          },
        });
      }),
    );

    logger.log(`Classified batch ${Math.floor(i / batchSize) + 1}: ${updates.length} customers`);
  }

  return {
    total: inactiveCustomers.length,
    classified: inactiveCustomers.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 재활성화 점수 계산 (0-100)
 *
 * 점수 구성:
 * - 부재 기간 (0-30점): 최근 부재일수록 높음
 * - 만족도 (0-20점): lastSatisfactionScore 기반
 * - 재구매 횟수 (0-20점): cruiseCount 기반
 * - VIP 등급 (0-20점): vipStatus 기반
 * - 최근 접점 (0-10점): lastContactedAt 기반
 */
function calculateReactivationScore(customer: any): ReactivationClassification {
  let score = 0;

  // 1. 부재 기간 (0-30점): 3-6개월 = 25점, 6-12개월 = 20점, 1년+ = 10점
  const lastCruiseDate = customer.lastCruiseDate || customer.purchasedAt;
  const monthsInactive = getMonthsSince(lastCruiseDate);
  let segmentScore = 0;
  let segment: '3-6m' | '6-12m' | '1y+';

  if (monthsInactive < 6) {
    segment = '3-6m';
    segmentScore = 30; // 가장 최근 = 가장 높은 재예약율
  } else if (monthsInactive < 12) {
    segment = '6-12m';
    segmentScore = 20;
  } else {
    segment = '1y+';
    segmentScore = 10;
  }
  score += segmentScore;

  // 2. 만족도 (0-20점): 만족도 점수가 높을수록 재예약 가능성 높음
  if (customer.lastSatisfactionScore) {
    const satisfactionScore = Math.min(customer.lastSatisfactionScore / 5 * 20, 20); // 5점 만점 → 20점 만점
    score += satisfactionScore;
  }

  // 3. 재구매 횟수 (0-20점): 이전 구매 횟수가 많을수록 재구매 가능성 높음
  const cruiseScore = Math.min((customer.cruiseCount || 1) * 5, 20); // 최대 20점
  score += cruiseScore;

  // 4. VIP 등급 (0-20점)
  if (customer.vipStatus === 'GOLD') {
    score += 20;
  } else if (customer.vipStatus === 'SILVER') {
    score += 10;
  }

  // 5. 최근 접점 (0-10점): 최근에 연락할수록 점수 높음
  if (customer.lastContactedAt) {
    const daysSinceContact = getDaysSince(customer.lastContactedAt);
    if (daysSinceContact < 30) {
      score += 10;
    } else if (daysSinceContact < 90) {
      score += 5;
    }
  }

  // 스코어 정규화 (0-100)
  const normalizedScore = Math.min(score, 100);

  return {
    segment,
    likelihood: normalizedScore,
    score: normalizedScore,
  };
}

/**
 * 지정된 날짜로부터 경과한 개월 수
 */
function getMonthsSince(date: Date | null): number {
  if (!date) return 24; // 기본값: 2년

  const now = new Date();
  const months = Math.floor(
    (now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );

  return Math.max(months, 0);
}

/**
 * 지정된 날짜로부터 경과한 일 수
 */
function getDaysSince(date: Date): number {
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24),
  );

  return Math.max(days, 0);
}

/**
 * 세그먼트별 통계 조회
 */
export async function getReactivationStats(organizationId: string) {
  const segments = await prisma.contact.groupBy({
    by: ['reactivationSegment'],
    where: {
      organizationId,
      deletedAt: null,
      reactivationSegment: { not: null },
    },
    _count: {
      id: true,
    },
    _avg: {
      reactivationLikelihood: true,
    },
  });

  return segments.map((seg) => ({
    segment: seg.reactivationSegment,
    count: seg._count.id,
    avgLikelihood: Math.round(seg._avg.reactivationLikelihood || 0),
  }));
}

/**
 * 크론 작업용: 매일 자동 분류
 * (cron-job으로 호출됨)
 */
export async function dailyReactivationClassification() {
  // 모든 조직에 대해 분류 수행
  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  const results = [];

  for (const org of organizations) {
    try {
      const result = await classifyReactivationCustomers(org.id);
      results.push({ organizationId: org.id, ...result });
    } catch (error) {
      logger.error(`Failed to classify reactivation for org ${org.id}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  return results;
}
