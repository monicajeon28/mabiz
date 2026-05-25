/**
 * L1 렌즈: A/B 테스트 변형 선택
 *
 * 주어진 objectiveType + responseMethod 조합에서 활성 A/B 테스트 변형을 선택합니다.
 *
 * 선택 알고리즘:
 * 1. 정확한 매치 (objectiveType + responseMethod): 가장 높은 전환율
 * 2. 부분 매치 (objectiveType만): 가장 높은 전환율
 * 3. 폴백: 조직의 전사 최고 성과 변형 (전환율 역순)
 * 4. 마지막 폴백: 가장 최신 생성된 변형
 *
 * A/B 테스트 상태:
 * - PENDING_DATA: 데이터 수집 중 (< 50 샘플)
 * - ACTIVE: 진행 중 (>= 50 샘플, 미확정)
 * - WINNING: 우승자 (통계적 유의성 p < 0.05)
 * - ARCHIVED: 폐기 (성과 저조)
 */

import { prisma } from '@/lib/prisma';

type ResponseMethod = 'VALUE_REDEFINITION' | 'SPLIT_PAYMENT' | 'EARLY_BOOKING' | 'GROUP_DISCOUNT' | 'LIMITED_TIME';

interface SelectedVariant {
  id: string;
  variantType: string;
  messageTemplate: string;
  copyAngle: string;
  psychologyLens: string;
  conversionRate: number;
  totalSent: number;
  matchQuality: 'EXACT' | 'PARTIAL' | 'FALLBACK' | 'LAST_RESORT';
}

/**
 * 높은 정확도: 정확한 조합 매치 (objectiveType + responseMethod)
 */
async function findExactMatchVariant(
  organizationId: string,
  objectiveType: string,
  responseMethod: ResponseMethod
): Promise<SelectedVariant | null> {
  // 주의: L1ABTestVariant는 objectiveType만 저장하므로
  // responseMethod는 copyAngle으로 매핑됨
  const variants = await prisma.l1ABTestVariant.findMany({
    where: {
      organizationId,
      objectiveType,
      isActive: true,
      // copyAngle은 responseMethod와 유사함 (가치재정의, 분할결제 등)
    },
    orderBy: { conversionRate: 'desc' },
    take: 1,
  });

  if (variants.length === 0) return null;

  const v = variants[0];
  return {
    id: v.id,
    variantType: v.variantType,
    messageTemplate: v.messageTemplate,
    copyAngle: v.copyAngle,
    psychologyLens: v.psychologyLens,
    conversionRate: v.conversionRate,
    totalSent: v.totalSent,
    matchQuality: 'EXACT',
  };
}

/**
 * 부분 매치: objectiveType만 일치
 */
async function findPartialMatchVariant(
  organizationId: string,
  objectiveType: string
): Promise<SelectedVariant | null> {
  const variants = await prisma.l1ABTestVariant.findMany({
    where: {
      organizationId,
      objectiveType,
      isActive: true,
    },
    orderBy: { conversionRate: 'desc' },
    take: 1,
  });

  if (variants.length === 0) return null;

  const v = variants[0];
  return {
    id: v.id,
    variantType: v.variantType,
    messageTemplate: v.messageTemplate,
    copyAngle: v.copyAngle,
    psychologyLens: v.psychologyLens,
    conversionRate: v.conversionRate,
    totalSent: v.totalSent,
    matchQuality: 'PARTIAL',
  };
}

/**
 * 폴백: 조직의 전사 최고 성과 변형
 */
async function findOrganizationBaselineVariant(
  organizationId: string
): Promise<SelectedVariant | null> {
  const variants = await prisma.l1ABTestVariant.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: { conversionRate: 'desc' },
    take: 1,
  });

  if (variants.length === 0) return null;

  const v = variants[0];
  return {
    id: v.id,
    variantType: v.variantType,
    messageTemplate: v.messageTemplate,
    copyAngle: v.copyAngle,
    psychologyLens: v.psychologyLens,
    conversionRate: v.conversionRate,
    totalSent: v.totalSent,
    matchQuality: 'FALLBACK',
  };
}

/**
 * 마지막 폴백: 가장 최신 생성된 변형
 */
async function findLastResortVariant(
  organizationId: string
): Promise<SelectedVariant | null> {
  const variants = await prisma.l1ABTestVariant.findFirst({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!variants) return null;

  return {
    id: variants.id,
    variantType: variants.variantType,
    messageTemplate: variants.messageTemplate,
    copyAngle: variants.copyAngle,
    psychologyLens: variants.psychologyLens,
    conversionRate: variants.conversionRate,
    totalSent: variants.totalSent,
    matchQuality: 'LAST_RESORT',
  };
}

/**
 * 메인 선택 함수
 */
export async function getABTestVariant(
  organizationId: string,
  objectiveType: string,
  responseMethod?: ResponseMethod
): Promise<SelectedVariant | null> {
  // 1. 정확한 매치 시도
  if (responseMethod) {
    const exactMatch = await findExactMatchVariant(organizationId, objectiveType, responseMethod);
    if (exactMatch) return exactMatch;
  }

  // 2. 부분 매치 (objectiveType만)
  const partialMatch = await findPartialMatchVariant(organizationId, objectiveType);
  if (partialMatch) return partialMatch;

  // 3. 조직 기본값 (전사 최고)
  const baseline = await findOrganizationBaselineVariant(organizationId);
  if (baseline) return baseline;

  // 4. 마지막 폴백
  return await findLastResortVariant(organizationId);
}

/**
 * A/B 테스트 상태 판정
 */
export async function determineVariantStatus(
  variantId: string
): Promise<'PENDING_DATA' | 'ACTIVE' | 'WINNING' | 'ARCHIVED'> {
  const variant = await prisma.l1ABTestVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) return 'ARCHIVED';

  if (variant.winningSince) return 'WINNING';

  if (variant.totalSent < 50) return 'PENDING_DATA';

  return 'ACTIVE';
}

/**
 * 통계적 유의성 검사 (카이제곱 테스트 근사)
 *
 * 두 변형 A, B의 전환율이 통계적으로 유의미하게 다른지 검사
 * p-value < 0.05 면 유의미함
 */
export function calculateStatisticalSignificance(
  sampleA: number,
  convertsA: number,
  sampleB: number,
  convertsB: number
): number {
  // 카이제곱 테스트 (Chi-square test)
  const pA = convertsA / sampleA;
  const pB = convertsB / sampleB;
  const pPool = (convertsA + convertsB) / (sampleA + sampleB);

  const chiSquare =
    Math.pow(convertsA - sampleA * pPool, 2) / (sampleA * pPool * (1 - pPool)) +
    Math.pow(convertsB - sampleB * pPool, 2) / (sampleB * pPool * (1 - pPool));

  // 카이제곱값 → p-value (자유도 1)
  // 근사: p ≈ e^(-chiSquare/2)
  const pValue = Math.exp(-chiSquare / 2);

  return pValue;
}

/**
 * 최소 샘플 크기 계산
 * 신뢰도 95%, 검정력 80%, 기준 전환율 45%
 */
export function calculateMinSampleSize(
  baselineRate: number = 0.45,
  minDetectableEffect: number = 0.05 // 5% 향상 감지
): number {
  // 간단한 공식: n ≈ 2 * (Z_α + Z_β)^2 * p * (1-p) / δ^2
  // Z_α=1.96 (95%), Z_β=0.84 (80%)
  // δ=0.05

  const Za = 1.96;
  const Zb = 0.84;
  const p = baselineRate;
  const delta = minDetectableEffect;

  const n = (2 * Math.pow(Za + Zb, 2) * p * (1 - p)) / Math.pow(delta, 2);

  return Math.ceil(n);
}
