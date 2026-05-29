import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey
);

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const searchParams = req.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: 'fromDate and toDate are required' },
        { status: 400 }
      );
    }

    // DB 함수 호출 (모든 Day별 집계를 데이터베이스에서 처리)
    const { data: dayStats, error: rpcError } = await supabase.rpc(
      'get_day_progression_stats',
      {
        p_org_id: req.headers.get('x-organization-id') || '',
        p_from_date: fromDate,
        p_to_date: toDate,
      }
    );

    if (rpcError) {
      logger.error('RPC get_day_progression_stats error:', rpcError);
      throw rpcError;
    }

    if (!dayStats || dayStats.length === 0) {
      return NextResponse.json({
        progression: [0, 1, 2, 3].map(day => ({
          day,
          sent: 0,
          clicked: 0,
          submitted: 0,
          openRate: '0.0',
          completionRate: '0.0',
          estimatedRevenue: 0,
          trend: day === 0 ? 'baseline' : 'stable',
        })),
        cumulative: {
          totalSent: 0,
          totalClicked: 0,
          totalSubmitted: 0,
          totalRevenue: 0,
        },
        summary: {
          overallSuccessRate: '0.0%',
          avgOpenRate: '0.0',
          dayComparison: [1, 2, 3].map(day => ({
            day,
            clicksDelta: 0,
            changePercent: '+0.0%',
          })),
        },
        lastUpdated: new Date().toISOString(),
        performanceMs: Date.now() - startTime,
      });
    }

    // 결과 포맷팅
    const dayProgression = dayStats.map((d: any) => ({
      day: d.day_index,
      sent: d.sent_count,
      clicked: d.clicked_count,
      submitted: d.submitted_count,
      openRate: String(d.open_rate || 0),
      completionRate: String(d.completion_rate || 0),
      estimatedRevenue: Number(d.estimated_revenue || 0),
      trend: d.trend,
    }));

    // 누적 지표 계산
    const cumulativeStats = {
      totalSent: dayProgression.reduce((sum: number, d: any) => sum + d.sent, 0),
      totalClicked: dayProgression.reduce((sum: number, d: any) => sum + d.clicked, 0),
      totalSubmitted: dayProgression.reduce((sum: number, d: any) => sum + d.submitted, 0),
      totalRevenue: Math.round(dayProgression.reduce((sum: number, d: any) => sum + d.estimatedRevenue, 0) * 10) / 10,
    };

    // 종합 성공도
    const overallSuccessRate =
      cumulativeStats.totalSent > 0
        ? ((cumulativeStats.totalSubmitted / cumulativeStats.totalSent) * 100).toFixed(1)
        : '0.0';

    // Day별 대비 분석
    const dayComparison = [];
    const day0Data = dayProgression[0];

    for (let i = 1; i < dayProgression.length; i++) {
      const dayData = dayProgression[i];
      const changeInClicks = dayData.clicked - day0Data.clicked;
      const changePercent = day0Data.clicked > 0
        ? ((changeInClicks / day0Data.clicked) * 100).toFixed(1)
        : '0.0';

      dayComparison.push({
        day: dayData.day,
        clicksDelta: changeInClicks,
        changePercent: `${Number(changePercent) >= 0 ? '+' : ''}${changePercent}%`,
      });
    }

    const elapsedMs = Date.now() - startTime;
    logger.log(`[DayProgression] Completed in ${elapsedMs}ms`, {
      dayCount: dayStats.length,
      totalSent: cumulativeStats.totalSent,
      totalClicked: cumulativeStats.totalClicked,
    });

    return NextResponse.json({
      progression: dayProgression,
      cumulative: cumulativeStats,
      summary: {
        overallSuccessRate: `${overallSuccessRate}%`,
        avgOpenRate: (
          dayProgression.reduce((sum: number, d: any) => sum + Number(d.openRate), 0) /
          dayProgression.length
        ).toFixed(1),
        dayComparison,
      },
      lastUpdated: new Date().toISOString(),
      performanceMs: elapsedMs,
    });
  } catch (error) {
    logger.error('Loop5 day progression error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch day progression' },
      { status: 500 }
    );
  }
}
