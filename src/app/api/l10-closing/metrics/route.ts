import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

/**
 * L10 렌즈 - KPI 메트릭 (실시간 성과 추적)
 *
 * 측정 항목:
 * - 감정적 연결도 (emotionalConnectionScore)
 * - 긴박감 수준 (urgencyLevel)
 * - L10 클로징 준비도 (l10ClosingScore)
 * - 전환율 (conversion rate)
 * - 평균 클로징 시간
 */

interface MetricsQuery {
  organizationId?: string;
  dateFrom?: string;
  dateTo?: string;
  segment?: string; // "all", "high_potential", "ready_close", "converted"
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const segment = searchParams.get('segment') || 'all';

    const organizationId = auth.organizationId;

    // 기본 날짜 설정 (지난 30일)
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();

    // 전체 고객 수
    const totalContacts = await prisma.contact.count({
      where: {
        organizationId,
        createdAt: { gte: from, lte: to },
      },
    });

    // L10 클로징 준비도별 분류
    const contactsByClosingScore = await prisma.contact.groupBy({
      by: ['closingStage'],
      where: {
        organizationId,
        createdAt: { gte: from, lte: to },
      },
      _count: true,
      _avg: {
        l10ClosingScore: true,
        emotionalConnectionScore: true,
        urgencyLevel: true,
      },
    });

    // 감정 연결도 분석
    const emotionalAnalysis = await prisma.contact.aggregate({
      where: {
        organizationId,
        createdAt: { gte: from, lte: to },
      },
      _avg: {
        emotionalConnectionScore: true,
      },
      _max: {
        emotionalConnectionScore: true,
      },
      _min: {
        emotionalConnectionScore: true,
      },
    });

    // 삼중선택 제안 통계
    const tripleChoiceStats = await prisma.contact.aggregate({
      where: {
        organizationId,
        tripleChoiceOffered: true,
        createdAt: { gte: from, lte: to },
      },
      _count: true,
    });

    const tripleChoiceConverted = await prisma.contact.count({
      where: {
        organizationId,
        tripleChoiceOffered: true,
        tripleChoiceSelectedAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
    });

    const tripleChoiceConversionRate =
      tripleChoiceStats._count > 0
        ? Math.round((tripleChoiceConverted / tripleChoiceStats._count) * 100)
        : 0;

    // 감정적 마무리 통계
    const emotionalFinishStats = await prisma.contact.count({
      where: {
        organizationId,
        emotionalFinishSentAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
    });

    const emotionalFinishConverted = await prisma.contact.count({
      where: {
        organizationId,
        emotionalFinishSentAt: { not: null },
        l10ConversionAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
    });

    const emotionalFinishConversionRate =
      emotionalFinishStats > 0
        ? Math.round((emotionalFinishConverted / emotionalFinishStats) * 100)
        : 0;

    // 긴박감 통계
    const urgencyStats = await prisma.contact.aggregate({
      where: {
        organizationId,
        urgencyLevel: { gt: 0 },
        createdAt: { gte: from, lte: to },
      },
      _avg: {
        urgencyLevel: true,
      },
      _count: true,
    });

    const urgencyConverted = await prisma.contact.count({
      where: {
        organizationId,
        urgencyLevel: { gt: 0 },
        l10ConversionAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
    });

    const urgencyConversionRate =
      urgencyStats._count > 0
        ? Math.round((urgencyConverted / urgencyStats._count) * 100)
        : 0;

    // 전체 L10 전환율
    const l10Converted = await prisma.contact.count({
      where: {
        organizationId,
        l10ConversionAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
    });

    const l10ConversionRate =
      totalContacts > 0 ? Math.round((l10Converted / totalContacts) * 100) : 0;

    // 고객 세그먼트별 분석
    const segmentAnalysis = await prisma.contact.groupBy({
      by: ['closingStage'],
      where: {
        organizationId,
        createdAt: { gte: from, lte: to },
      },
      _count: true,
      _avg: {
        l10ClosingScore: true,
      },
    });

    // 평균 클로징 시간
    const closingTimeData = await prisma.contact.findMany({
      where: {
        organizationId,
        l10ConversionAt: { not: null },
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        l10ConversionAt: true,
      },
    });

    const closingTimes = closingTimeData.map((c) => {
      const timeMs = c.l10ConversionAt!.getTime() - c.createdAt.getTime();
      return timeMs / (1000 * 60 * 60); // hours
    });

    const averageClosingHours =
      closingTimes.length > 0
        ? Math.round(
          closingTimes.reduce((a, b) => a + b, 0) / closingTimes.length
        )
        : 0;

    // 효과 비율 계산
    const baselineConversionRate = 70; // L10의 기본 전환율
    const conversionLift = Math.round(
      ((l10ConversionRate - baselineConversionRate) / baselineConversionRate) *
      100
    );

    return NextResponse.json({
      success: true,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      overview: {
        totalContacts,
        l10Converted,
        l10ConversionRate: `${l10ConversionRate}%`,
        conversionLift: `${conversionLift > 0 ? '+' : ''}${conversionLift}%`,
      },
      closingStageBreakdown: contactsByClosingScore.map((stage) => ({
        stage: stage.closingStage || 'unknown',
        count: stage._count,
        avgL10Score: Math.round(stage._avg.l10ClosingScore || 0),
        avgEmotionalScore: Math.round(stage._avg.emotionalConnectionScore || 0),
        avgUrgencyLevel: Math.round(stage._avg.urgencyLevel || 0),
      })),
      emotionalConnection: {
        averageScore: Math.round(
          emotionalAnalysis._avg.emotionalConnectionScore || 0
        ),
        maxScore: emotionalAnalysis._max.emotionalConnectionScore || 0,
        minScore: emotionalAnalysis._min.emotionalConnectionScore || 0,
        interpretation: `감정적 연결도: ${Math.round(emotionalAnalysis._avg.emotionalConnectionScore || 0)}/100 (${
          (emotionalAnalysis._avg.emotionalConnectionScore || 0) > 70
            ? '매우 강함'
            : (emotionalAnalysis._avg.emotionalConnectionScore || 0) > 50
            ? '중간'
            : '약함'
        })`,
      },
      tripleChoice: {
        offered: tripleChoiceStats._count,
        selected: tripleChoiceConverted,
        conversionRate: `${tripleChoiceConversionRate}%`,
        effectiveness: `${tripleChoiceConversionRate > 80 ? '매우 효과적' : tripleChoiceConversionRate > 60 ? '효과적' : '개선 필요'}`,
      },
      emotionalFinish: {
        applied: emotionalFinishStats,
        converted: emotionalFinishConverted,
        conversionRate: `${emotionalFinishConversionRate}%`,
        effectiveness: `${emotionalFinishConversionRate > 85 ? '매우 효과적' : emotionalFinishConversionRate > 70 ? '효과적' : '개선 필요'}`,
      },
      urgency: {
        applied: urgencyStats._count,
        converted: urgencyConverted,
        averageLevel: Math.round(urgencyStats._avg.urgencyLevel || 0),
        conversionRate: `${urgencyConversionRate}%`,
        effectiveness: `${urgencyConversionRate > 75 ? '매우 효과적' : urgencyConversionRate > 60 ? '효과적' : '개선 필요'}`,
      },
      timingAnalysis: {
        averageClosingHours,
        averageClosingDays: Math.round(averageClosingHours / 24),
        fastestClosing: closingTimes.length > 0 ? Math.min(...closingTimes) : 0,
        slowestClosing: closingTimes.length > 0 ? Math.max(...closingTimes) : 0,
        interpretation: `평균 클로징 시간: ${averageClosingHours}시간`,
      },
      psychologyMetrics: {
        l10ClosingScore: {
          overall: Math.round(
            contactsByClosingScore.reduce(
              (sum, stage) =>
                sum + (stage._avg.l10ClosingScore || 0) * stage._count,
              0
            ) / totalContacts
          ),
          trend: '상향' as const,
          impact: '클로징 준비도',
        },
        emotionalConnection: {
          overall: Math.round(
            emotionalAnalysis._avg.emotionalConnectionScore || 0
          ),
          trend: '상향' as const,
          impact: '신청 완료율',
        },
        urgencyLevel: {
          overall: Math.round(urgencyStats._avg.urgencyLevel || 0),
          trend: '중립' as const,
          impact: '신청 속도',
        },
      },
      recommendations: [
        ...(l10ConversionRate < 75
          ? ['L10 클로징 전략 개선 필요: 감정적 마무리 강도 증가']
          : []),
        ...(tripleChoiceConversionRate < 70
          ? ['삼중선택 오퍼 최적화: 감정 톤 변형 시도']
          : []),
        ...(emotionalFinishConversionRate < 80
          ? ['감정적 메시지 개선: 더 강한 스토리텔링 적용']
          : []),
        ...(urgencyConversionRate < 70
          ? ['긴박감 강도 증가: 가격/희소성 트리거 활용']
          : []),
        ...(averageClosingHours > 24
          ? ['클로징 속도 개선: 콜 플레이북 강화']
          : []),
      ],
      estimatedMonthlyRevenue: {
        baselineConversion: `${baselineConversionRate}% (${totalContacts} contacts → ${Math.round(totalContacts * (baselineConversionRate / 100))} customers)`,
        optimizedConversion: `${l10ConversionRate}% (${totalContacts} contacts → ${l10Converted} customers)`,
        additionalRevenue: `${l10Converted - Math.round(totalContacts * (baselineConversionRate / 100))} additional customers`,
        estimatedValue: `$${(l10Converted - Math.round(totalContacts * (baselineConversionRate / 100))) * 250}k+ (assuming $250k per customer LTV)`,
      },
    });
  } catch (error) {
    logger.error('[GET /api/l10-closing/metrics]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
