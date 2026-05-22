export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/onboarding/stats
 *
 * 목적:
 * - SMS 온보딩 마법사의 일일 통계 조회
 * - 각 Day별 발송 현황
 * - 자동 저장 vs 수동 검토 vs 재질문 통계
 * - 세그먼트 분류 현황
 *
 * 쿼리 파라미터:
 * - organizationId (필수)
 * - dateFrom: YYYY-MM-DD (기본값: 오늘)
 * - dateTo: YYYY-MM-DD (기본값: 오늘)
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: 'organizationId 필수' },
      { status: 400 }
    );
  }

  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');

  // 날짜 범위 설정
  const dateFrom = dateFromParam ? new Date(dateFromParam) : new Date();
  dateFrom.setHours(0, 0, 0, 0);

  const dateTo = dateToParam ? new Date(dateToParam) : new Date();
  dateTo.setHours(23, 59, 59, 999);

  try {
    // 1. 미분류 고객 수
    const unclassifiedCount = await prisma.contact.count({
      where: {
        organizationId,
        autoSegment: 'unclassified',
        smsOptIn: true,
        deletedAt: null,
      },
    });

    // 2. ContactLensSequence 통계 (ONBOARDING)
    const sequences = await prisma.contactLensSequence.findMany({
      where: {
        organizationId,
        sequenceType: 'ONBOARDING',
        startedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: {
        day0Sent: true,
        day0SentAt: true,
        day1Sent: true,
        day1SentAt: true,
        day2Sent: true,
        day2SentAt: true,
        day3Sent: true,
        day3SentAt: true,
        completedAt: true,
        status: true,
      },
    });

    // 3. 통계 계산
    let day0Sent = 0;
    let day1Sent = 0;
    let day2Sent = 0;
    let day3Sent = 0;
    let completionCount = 0;

    sequences.forEach((seq) => {
      if (seq.day0Sent) day0Sent++;
      if (seq.day1Sent) day1Sent++;
      if (seq.day2Sent) day2Sent++;
      if (seq.day3Sent) day3Sent++;
      if (seq.completedAt) completionCount++;
    });

    // 4. 세그먼트별 분류 현황
    const segmentStats = await prisma.contact.groupBy({
      by: ['autoSegment'],
      where: {
        organizationId,
        deletedAt: null,
        smsOptIn: true,
      },
      _count: {
        id: true,
      },
    });

    const segmentCounts: Record<string, number> = {};
    segmentStats.forEach((stat) => {
      segmentCounts[stat.autoSegment || 'unknown'] = stat._count.id;
    });

    // 5. 일일 SMS 발송 로그 (SmsLog 테이블 - 있다면)
    // 현재 구현에서는 Redis 큐를 사용하므로 skip
    // 나중에 SmsLog 테이블로 마이그레이션 시 추가

    const totalSequences = sequences.length;
    const completionRate = totalSequences > 0
      ? ((completionCount / totalSequences) * 100).toFixed(2)
      : '0.00';

    const result = {
      ok: true,
      timestamp: new Date().toISOString(),
      dateRange: {
        from: dateFrom.toISOString().split('T')[0],
        to: dateTo.toISOString().split('T')[0],
      },
      summary: {
        unclassifiedCount,
        totalSequencesStarted: totalSequences,
        completionCount,
        completionRate: parseFloat(completionRate),
      },
      daywise: {
        day0: {
          sent: day0Sent,
          percentage: totalSequences > 0
            ? ((day0Sent / totalSequences) * 100).toFixed(2)
            : '0.00',
        },
        day1: {
          sent: day1Sent,
          percentage: totalSequences > 0
            ? ((day1Sent / totalSequences) * 100).toFixed(2)
            : '0.00',
        },
        day2: {
          sent: day2Sent,
          percentage: totalSequences > 0
            ? ((day2Sent / totalSequences) * 100).toFixed(2)
            : '0.00',
        },
        day3: {
          sent: day3Sent,
          percentage: totalSequences > 0
            ? ((day3Sent / totalSequences) * 100).toFixed(2)
            : '0.00',
        },
      },
      segmentCounts,
      conversionFunnel: {
        day0: `${day0Sent}명 (100%)`,
        day1: `${day1Sent}명 (${day0Sent > 0 ? ((day1Sent / day0Sent) * 100).toFixed(1) : 0}%)`,
        day2: `${day2Sent}명 (${day1Sent > 0 ? ((day2Sent / day1Sent) * 100).toFixed(1) : 0}%)`,
        day3: `${day3Sent}명 (${day2Sent > 0 ? ((day3Sent / day2Sent) * 100).toFixed(1) : 0}%)`,
        completed: `${completionCount}명 (${day3Sent > 0 ? ((completionCount / day3Sent) * 100).toFixed(1) : 0}%)`,
      },
      targets: {
        dailyTarget: 500,
        estimatedMonthlyClassified: unclassifiedCount > 0
          ? Math.ceil((unclassifiedCount / 500) * 30)
          : 0,
        estimatedMonthlyConversionAt85pct:
          Math.ceil((unclassifiedCount / 500) * 30 * 0.85),
      },
    };

    logger.info('[OnboardingStats] 조회 완료', {
      organizationId,
      unclassifiedCount,
      totalSequences,
      completionRate,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[OnboardingStats] 오류', { error });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}
