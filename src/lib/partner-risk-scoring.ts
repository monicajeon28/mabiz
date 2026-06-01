import prisma from '@/lib/prisma';

export interface PartnerRiskSignal {
  partnerId: string;
  organizationId: string;
  lowPerformanceScore: number; // 0-25
  churnScore: number; // 0-25
  dishonestyScore: number; // 0-25
  skillGapScore: number; // 0-25
}

export interface RiskScoringResult {
  totalRiskScore: number; // 0-100
  level: 'GREEN' | 'YELLOW' | 'RED'; // 0-33, 34-66, 67-100
  flags: string[];
  recommendedAction: string;
  psychologyLens: string[];
}

// Risk Score 계산 (4개 신호 × 25점)
export function calculatePartnerRiskScore(
  signals: PartnerRiskSignal
): RiskScoringResult {
  const totalRiskScore = Math.min(
    100,
    signals.lowPerformanceScore +
      signals.churnScore +
      signals.dishonestyScore +
      signals.skillGapScore
  );

  const flags: string[] = [];
  if (signals.lowPerformanceScore > 15) flags.push('lowPerformance');
  if (signals.churnScore > 15) flags.push('churnIndicator');
  if (signals.dishonestyScore > 15) flags.push('dishonesty');
  if (signals.skillGapScore > 15) flags.push('skillGap');

  let level: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  if (totalRiskScore > 66) level = 'RED';
  else if (totalRiskScore > 33) level = 'YELLOW';

  // 심리학 렌즈 선택 (Grant Cardone)
  const psychologyLens: string[] = [];
  if (flags.includes('lowPerformance')) psychologyLens.push('L6-TimingLossAversion');
  if (flags.includes('churnIndicator')) psychologyLens.push('L10-ImmediateClosing');
  if (flags.includes('dishonesty')) psychologyLens.push('L9-TrustMedical');
  if (flags.includes('skillGap')) psychologyLens.push('L2-5StepMediation');

  // 추천 액션
  const recommendedAction = getRecommendedAction(level, flags);

  return {
    totalRiskScore,
    level,
    flags,
    recommendedAction,
    psychologyLens: [...new Set(psychologyLens)], // 중복 제거
  };
}

function getRecommendedAction(
  level: 'GREEN' | 'YELLOW' | 'RED',
  flags: string[]
): string {
  if (level === 'RED') {
    if (flags.includes('churnIndicator')) {
      return 'URGENT_RETENTION_SMS'; // Day 0-1 긴급 메시지
    }
    if (flags.includes('dishonesty')) {
      return 'MANAGER_REVIEW'; // 매니저 검토 필요
    }
    return 'INTERVENTION_CALL'; // 즉시 상담
  }

  if (level === 'YELLOW') {
    if (flags.includes('skillGap')) {
      return 'TRAINING_OFFER'; // 교육 제시
    }
    if (flags.includes('lowPerformance')) {
      return 'INCENTIVE_SMS'; // 인센티브 메시지
    }
    return 'MONITORING_CONTINUED'; // 지속 모니터링
  }

  return 'NO_ACTION'; // 정상
}

// 파트너 위험도 데이터 업데이트
export async function updatePartnerRiskScore(
  partnerId: string,
  organizationId: string
): Promise<RiskScoringResult | null> {
  try {
    // 최근 성과 데이터 조회 (최근 4주)
    const performances = await prisma.partnerPerformance.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });

    if (performances.length === 0) {
      return null;
    }

    // 저성과 신호 (4주 평균 전환율 < 15%)
    const avgConversionRate =
      performances.reduce((sum, p) => sum + (p.overallConversionRate || 0), 0) /
      performances.length;
    const lowPerformanceScore = avgConversionRate < 15 ? 25 : 0;

    // 이탈 신호 (최근 주 매출이 이전 주의 50% 미만)
    const recentRevenue = performances[0]?.revenue || 0;
    const previousRevenue = performances[1]?.revenue || 0;
    const churnScore =
      previousRevenue > 0 && recentRevenue < previousRevenue * 0.5 ? 25 : 0;

    // 정직성 신호 (매니저 리뷰 필요 - 외부 입력)
    const dishonestyScore = 0; // 수동 설정 필요

    // 기술 부족 신호 (자동화율 < 20%)
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { automationRate: true },
    });
    const skillGapScore = partner && partner.automationRate < 20 ? 25 : 0;

    const signals: PartnerRiskSignal = {
      partnerId,
      organizationId,
      lowPerformanceScore,
      churnScore,
      dishonestyScore,
      skillGapScore,
    };

    const result = calculatePartnerRiskScore(signals);

    // 데이터베이스 업데이트
    await prisma.partnerRiskFlags.upsert({
      where: { partnerId },
      create: {
        partnerId,
        lowPerformance: signals.lowPerformanceScore > 0,
        churnIndicator: signals.churnScore > 0,
        dishonesty: signals.dishonestyScore > 0,
        skillGap: signals.skillGapScore > 0,
        lowPerformanceScore,
        churnScore,
        dishonestyScore,
        skillGapScore,
        totalRiskScore: result.totalRiskScore,
      },
      update: {
        lowPerformance: signals.lowPerformanceScore > 0,
        churnIndicator: signals.churnScore > 0,
        dishonesty: signals.dishonestyScore > 0,
        skillGap: signals.skillGapScore > 0,
        lowPerformanceScore,
        churnScore,
        dishonestyScore,
        skillGapScore,
        totalRiskScore: result.totalRiskScore,
      },
    });

    return result;
  } catch (error) {
    console.error('[updatePartnerRiskScore] 오류:', error);
    return null;
  }
}

// SMS Day 0-3 메시지 생성 (Psychology Lens 기반)
export function generateDay03Messages(
  result: RiskScoringResult,
  partnerName: string,
  partnerPhone: string
): Record<string, string> {
  const dayMessages: Record<string, string> = {};

  if (result.level === 'RED') {
    // Day 0: 긴급 상황 (PASONA P-A)
    dayMessages.day0 = `${partnerName}님, 최근 성과가 감소했습니다. 지금 상담받으세요 → ${partnerPhone}`;

    // Day 1: 자극 & 해결책 (L6 손실회피)
    dayMessages.day1 = `기회를 놓치고 계신가요? 이번 달이 마지막입니다! 월급 보너스 +500만원 기회 ${partnerName}님`;

    // Day 2: 오퍼 & 좁혀진 범위 (L10 즉시구매)
    dayMessages.day2 = `${partnerName}님! 즉시 신청 시 교육 무료 + 특별 수당 지급. 오늘만 가능합니다`;

    // Day 3: 긴박감 & 액션 (L6+L10)
    dayMessages.day3 = `${partnerName}님, 마지막 경고입니다. 내일부터 보너스 50% 감소합니다. 지금 신청: [link]`;
  } else if (result.level === 'YELLOW') {
    // Day 0: 문제 인식
    dayMessages.day0 = `${partnerName}님, 최근 매출 변화를 알려드립니다. 1:1 상담 예약 클릭`;

    // Day 1: 자극 & 해결
    dayMessages.day1 = `${partnerName}님의 목표 월 수입 달성까지 남은 시간이 적습니다. 지금 전략 바꾸세요`;

    // Day 2: 오퍼
    dayMessages.day2 = `제휴사 중 상위 10% ${partnerName}님을 위한 VIP 교육 프로그램 오픈`;

    // Day 3: 액션
    dayMessages.day3 = `${partnerName}님, 이번 주 신청하면 다음달 보너스 선입금 제공합니다 [link]`;
  } else {
    // Green: 긍정 강화
    dayMessages.day0 = `${partnerName}님, 이번달 매출 축하합니다! 다음 목표 설정 상담`;
    dayMessages.day1 = `상위 5% 파트너 ${partnerName}님을 위한 특별 프로그램`;
    dayMessages.day2 = `${partnerName}님 고객 확대 팩: 리드 +50개 + 교육 무료`;
    dayMessages.day3 = `${partnerName}님과 함께 2026년 $1M 목표 달성해요!`;
  }

  return dayMessages;
}
