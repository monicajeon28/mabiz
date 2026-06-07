import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';

interface MetricsByDay {
  [key: string]: {
    sent: number;
    clicked: number;
    converted: number;
    rate: string;
  };
}

interface MetricsBySegment {
  [key: string]: {
    sent: number;
    clicked: number;
    converted: number;
  };
}

/**
 * SMS Day 0-3 자동화 대시보드 메트릭
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);

    // Query parameters
    const searchParams = request.nextUrl.searchParams;
    const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 7; // 기본 7일

    // 최근 N일간의 메시지 조회
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const messages = await prisma.crmMarketingMessage.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate
        }
      },
      select: {
        id: true,
        day: true,
        segment: true,
        variant: true,
        status: true,
        scheduledTime: true,
        sentTime: true,
        clickCount: true,
        lastClickTime: true,
        conversionTime: true,
        expectedResponseRate: true,
        actualResponseTime: true
      }
    });

    // 메트릭 집계
    const metricsByDay: MetricsByDay = {
      '0': { sent: 0, clicked: 0, converted: 0, rate: '0%' },
      '1': { sent: 0, clicked: 0, converted: 0, rate: '0%' },
      '3': { sent: 0, clicked: 0, converted: 0, rate: '0%' },
      '7': { sent: 0, clicked: 0, converted: 0, rate: '0%' }
    };

    const metricsBySegment: MetricsBySegment = {
      newlywed: { sent: 0, clicked: 0, converted: 0 },
      family: { sent: 0, clicked: 0, converted: 0 },
      couple: { sent: 0, clicked: 0, converted: 0 }
    };

    const metricsByVariant = {
      default: { sent: 0, clicked: 0, converted: 0 },
      variantb: { sent: 0, clicked: 0, converted: 0 }
    };

    let totalSent = 0;
    let totalClicked = 0;
    let totalConverted = 0;

    // 메시지 집계
    messages.forEach(msg => {
      const dayKey = msg.day.toString();

      // Day별 메트릭
      if (metricsByDay[dayKey]) {
        metricsByDay[dayKey].sent += msg.status === 'sent' ? 1 : 0;
        if (msg.clickCount > 0) {
          metricsByDay[dayKey].clicked += 1;
        }
        if (msg.conversionTime) {
          metricsByDay[dayKey].converted += 1;
        }
      }

      // Segment별 메트릭
      const segment = msg.segment as keyof MetricsBySegment;
      if (metricsBySegment[segment]) {
        metricsBySegment[segment].sent += msg.status === 'sent' ? 1 : 0;
        if (msg.clickCount > 0) {
          metricsBySegment[segment].clicked += 1;
        }
        if (msg.conversionTime) {
          metricsBySegment[segment].converted += 1;
        }
      }

      // Variant별 메트릭
      const variant = msg.variant as keyof typeof metricsByVariant;
      metricsByVariant[variant].sent += msg.status === 'sent' ? 1 : 0;
      if (msg.clickCount > 0) {
        metricsByVariant[variant].clicked += 1;
      }
      if (msg.conversionTime) {
        metricsByVariant[variant].converted += 1;
      }

      // 전체 메트릭
      if (msg.status === 'sent') totalSent += 1;
      if (msg.clickCount > 0) totalClicked += 1;
      if (msg.conversionTime) totalConverted += 1;
    });

    // 클릭율 및 전환율 계산
    Object.keys(metricsByDay).forEach(key => {
      const sent = metricsByDay[key].sent;
      const clicked = metricsByDay[key].clicked;
      metricsByDay[key].rate = sent > 0 ? `${((clicked / sent) * 100).toFixed(1)}%` : '0%';
    });

    const overallClickRate = totalSent > 0 ? `${((totalClicked / totalSent) * 100).toFixed(1)}%` : '0%';
    const overallConversionRate = totalSent > 0 ? `${((totalConverted / totalSent) * 100).toFixed(1)}%` : '0%';

    // A/B 테스트 결과
    const abTestResults = {
      default: {
        sent: metricsByVariant.default.sent,
        clicked: metricsByVariant.default.clicked,
        clickRate: metricsByVariant.default.sent > 0
          ? `${((metricsByVariant.default.clicked / metricsByVariant.default.sent) * 100).toFixed(1)}%`
          : '0%',
        converted: metricsByVariant.default.converted,
        conversionRate: metricsByVariant.default.sent > 0
          ? `${((metricsByVariant.default.converted / metricsByVariant.default.sent) * 100).toFixed(1)}%`
          : '0%'
      },
      variantb: {
        sent: metricsByVariant.variantb.sent,
        clicked: metricsByVariant.variantb.clicked,
        clickRate: metricsByVariant.variantb.sent > 0
          ? `${((metricsByVariant.variantb.clicked / metricsByVariant.variantb.sent) * 100).toFixed(1)}%`
          : '0%',
        converted: metricsByVariant.variantb.converted,
        conversionRate: metricsByVariant.variantb.sent > 0
          ? `${((metricsByVariant.variantb.converted / metricsByVariant.variantb.sent) * 100).toFixed(1)}%`
          : '0%'
      }
    };

    return NextResponse.json({
      status: 'success',
      periodDays: days,
      totalSent,
      totalClicked,
      totalConverted,
      clickRate: overallClickRate,
      conversionRate: overallConversionRate,
      byDay: metricsByDay,
      bySegment: metricsBySegment,
      abTestResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in metrics:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
