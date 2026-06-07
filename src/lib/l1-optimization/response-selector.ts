/**
 * L1 렌즈: 최적 대응 방식 선택
 *
 * 가격 이의 유형에 따라 5가지 대응 방식 중 최적을 선택합니다:
 * 1. VALUE_REDEFINITION: 가치 재정의 (ROI 강조)
 * 2. SPLIT_PAYMENT: 분할 결제 옵션
 * 3. EARLY_BOOKING: 조기 예약 할인
 * 4. GROUP_DISCOUNT: 그룹 구매 할인
 * 5. LIMITED_TIME: 한정 시간 특가
 *
 * 선택 알고리즘:
 * - PRICE_HIGH → VALUE_REDEFINITION (가치 재정의) + LIMITED_TIME (긴박감)
 * - PAYMENT_TERMS → SPLIT_PAYMENT (분할 결제)
 * - ROI_DOUBT → VALUE_REDEFINITION (가치 재정의) + EARLY_BOOKING (신뢰도)
 * - COMPETITOR_COMPARE → VALUE_REDEFINITION (차별성) + GROUP_DISCOUNT (사회증명)
 * - AFFORD_DOUBT → SPLIT_PAYMENT (분할) + GROUP_DISCOUNT (그룹 할인)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

type ObjectiveType = 'PRICE_HIGH' | 'PAYMENT_TERMS' | 'ROI_DOUBT' | 'COMPETITOR_COMPARE' | 'AFFORD_DOUBT';
type ResponseMethod = 'VALUE_REDEFINITION' | 'SPLIT_PAYMENT' | 'EARLY_BOOKING' | 'GROUP_DISCOUNT' | 'LIMITED_TIME';

interface ResponseMapping {
  objectiveType: ObjectiveType;
  primaryMethod: ResponseMethod;
  secondaryMethods: ResponseMethod[];
  psychologyLenses: string[];
}

const RESPONSE_MAPPINGS: ResponseMapping[] = [
  {
    objectiveType: 'PRICE_HIGH',
    primaryMethod: 'VALUE_REDEFINITION',
    secondaryMethods: ['LIMITED_TIME', 'EARLY_BOOKING'],
    psychologyLenses: ['L1_LOSS_AVERSION', 'L1_SCARCITY', 'L10_IMMEDIATE_CLOSING'],
  },
  {
    objectiveType: 'PAYMENT_TERMS',
    primaryMethod: 'SPLIT_PAYMENT',
    secondaryMethods: ['VALUE_REDEFINITION', 'GROUP_DISCOUNT'],
    psychologyLenses: ['L1_AFFORDABILITY', 'L6_TIMING'],
  },
  {
    objectiveType: 'ROI_DOUBT',
    primaryMethod: 'VALUE_REDEFINITION',
    secondaryMethods: ['EARLY_BOOKING', 'LIMITED_TIME'],
    psychologyLenses: ['L1_VALUE_PROPOSITION', 'L8_HABITUAL_GROWTH', 'L9_MEDICAL_TRUST'],
  },
  {
    objectiveType: 'COMPETITOR_COMPARE',
    primaryMethod: 'VALUE_REDEFINITION',
    secondaryMethods: ['GROUP_DISCOUNT', 'EARLY_BOOKING'],
    psychologyLenses: ['L1_DIFFERENTIATION', 'L3_DIFFERENTIATION', 'L4_FEATURES'],
  },
  {
    objectiveType: 'AFFORD_DOUBT',
    primaryMethod: 'SPLIT_PAYMENT',
    secondaryMethods: ['GROUP_DISCOUNT', 'LIMITED_TIME'],
    psychologyLenses: ['L1_AFFORDABILITY', 'L7_COMPANION_PERSUASION', 'L5_SELF_PROJECTION'],
  },
];

/**
 * 기본: 이의 유형만으로 대응 방식 선택
 */
export function selectResponseMethod(objectiveType: ObjectiveType): ResponseMethod {
  const mapping = RESPONSE_MAPPINGS.find(m => m.objectiveType === objectiveType);
  return mapping?.primaryMethod || 'VALUE_REDEFINITION';
}

/**
 * 고급: 조직의 과거 성과 데이터를 반영하여 선택
 *
 * 로직:
 * 1. 같은 organizationId + objectiveType 조합의 과거 성과 조회
 * 2. 가장 높은 전환율을 가진 responseMethod 우선 사용
 * 3. 데이터 부족 시 기본 매핑 사용
 */
export async function selectOptimalResponseMethod(
  organizationId: string,
  objectiveType: ObjectiveType
): Promise<ResponseMethod> {
  try {
    // 과거 30일 성과 조회
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const performanceData = await prisma.l1PriceObjectionAttempt.groupBy({
      by: ['responseMethod'],
      where: {
        organizationId,
        objectiveType,
        sentAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    if (performanceData.length === 0) {
      // 데이터 없음: 기본 매핑 사용
      return selectResponseMethod(objectiveType);
    }

    // 정확한 전환율 계산
    const methodPerformance = await Promise.all(
      performanceData.map(async (perf) => {
        const attempts = await prisma.l1PriceObjectionAttempt.findMany({
          where: {
            organizationId,
            objectiveType,
            responseMethod: perf.responseMethod as ResponseMethod,
            sentAt: { gte: thirtyDaysAgo },
          },
          select: { conversionResult: true },
        });

        const converted = attempts.filter(a => a.conversionResult).length;
        const rate = attempts.length > 0 ? converted / attempts.length : 0;

        return {
          method: perf.responseMethod as ResponseMethod,
          conversionRate: rate,
          count: perf._count,
        };
      })
    );

    // 가장 높은 전환율 방식 선택
    const best = methodPerformance.reduce((prev, current) =>
      current.conversionRate > prev.conversionRate ? current : prev
    );

    return best.method;
  } catch (error) {
    // 에러 발생 시 기본 매핑 사용
    logger.warn('[L1] selectOptimalResponseMethod error, falling back to default', { error: error instanceof Error ? error.message : String(error) });
    return selectResponseMethod(objectiveType);
  }
}

/**
 * 세컨더리 메서드 선택 (추후 자동화 시퀀스용)
 */
export function selectSecondaryMethods(objectiveType: ObjectiveType): ResponseMethod[] {
  const mapping = RESPONSE_MAPPINGS.find(m => m.objectiveType === objectiveType);
  return mapping?.secondaryMethods || [];
}

/**
 * 대응 방식에 따른 심리학 렌즈 배열
 */
export function getPsychologyLenses(objectiveType: ObjectiveType): string[] {
  const mapping = RESPONSE_MAPPINGS.find(m => m.objectiveType === objectiveType);
  return mapping?.psychologyLenses || [];
}

/**
 * 대응 방식별 예상 전환율 (기준 데이터)
 * 실제로는 조직의 과거 성과 데이터로 대체되어야 함
 */
export const RESPONSE_METHOD_BASE_CONVERSION_RATES: Record<ResponseMethod, number> = {
  VALUE_REDEFINITION: 0.48,  // 48%
  SPLIT_PAYMENT: 0.52,       // 52%
  EARLY_BOOKING: 0.45,       // 45%
  GROUP_DISCOUNT: 0.50,      // 50%
  LIMITED_TIME: 0.55,        // 55% (가장 효과적)
};
