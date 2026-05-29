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

    // sms_logs 테이블에서 Day별 데이터 조회
    const { data: smsLogs, error: smsError } = await supabase
      .from('sms_logs')
      .select('id, created_at, contact_id, day_index')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: true });

    if (smsError) throw smsError;

    // campaign_events에서 클릭/폼 제출 데이터
    const { data: campaignEvents, error: eventError } = await supabase
      .from('campaign_events')
      .select('id, event_type, created_at, contact_id')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .in('event_type', ['LINK_CLICKED', 'FORM_SUBMITTED']);

    if (eventError) throw eventError;

    // Day 0-3별 진행 상황 분석
    const dayProgression: Array<{
      day: number;
      sent: number;
      clicked: number;
      submitted: number;
      openRate: string;
      completionRate: string;
      estimatedRevenue: number;
      trend: string;
    }> = [];

    const dayRange = [0, 1, 2, 3];
    const baseDateObj = new Date(fromDate);

    dayRange.forEach(day => {
      // 해당 day의 시작/종료 시간 계산
      const dayStart = new Date(baseDateObj);
      dayStart.setDate(dayStart.getDate() + day);
      const dayStartStr = dayStart.toISOString().split('T')[0];

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayEndStr = dayEnd.toISOString().split('T')[0];

      // Day별 SMS 발송 수
      const daySent = smsLogs?.filter(
        log => log.created_at >= dayStartStr && log.created_at < dayEndStr
      ).length || 0;

      // Day별 클릭 수
      const dayClicked = campaignEvents?.filter(
        e =>
          e.created_at >= dayStartStr &&
          e.created_at < dayEndStr &&
          e.event_type === 'LINK_CLICKED'
      ).length || 0;

      // Day별 폼 제출 수
      const daySubmitted = campaignEvents?.filter(
        e =>
          e.created_at >= dayStartStr &&
          e.created_at < dayEndStr &&
          e.event_type === 'FORM_SUBMITTED'
      ).length || 0;

      const openRate = daySent > 0 ? ((dayClicked / daySent) * 100).toFixed(1) : '0.0';
      const completionRate = dayClicked > 0 ? ((daySubmitted / dayClicked) * 100).toFixed(1) : '0.0';
      const estimatedRevenue = daySubmitted * 8.25;

      // 트렌드 판정 (Day 0 대비)
      let trend = 'stable';
      if (day === 0) {
        trend = 'baseline';
      } else if (Number(openRate) > 35) {
        trend = 'up';
      } else if (Number(openRate) < 25) {
        trend = 'down';
      }

      dayProgression.push({
        day,
        sent: daySent,
        clicked: dayClicked,
        submitted: daySubmitted,
        openRate,
        completionRate,
        estimatedRevenue: Math.round(estimatedRevenue * 10) / 10,
        trend,
      });
    });

    // 누적 지표 계산
    const cumulativeStats = {
      totalSent: dayProgression.reduce((sum, d) => sum + d.sent, 0),
      totalClicked: dayProgression.reduce((sum, d) => sum + d.clicked, 0),
      totalSubmitted: dayProgression.reduce((sum, d) => sum + d.submitted, 0),
      totalRevenue: Math.round(dayProgression.reduce((sum, d) => sum + d.estimatedRevenue, 0) * 10) / 10,
    };

    // 종합 성공도 (Day 0→3 누적)
    const overallSuccessRate =
      cumulativeStats.totalSent > 0
        ? ((cumulativeStats.totalSubmitted / cumulativeStats.totalSent) * 100).toFixed(1)
        : '0.0';

    // Day별 대비 분석 (Day 0 → Day 1, 2, 3)
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

    return NextResponse.json({
      progression: dayProgression,
      cumulative: cumulativeStats,
      summary: {
        overallSuccessRate: `${overallSuccessRate}%`,
        avgOpenRate: (
          dayProgression.reduce((sum, d) => sum + Number(d.openRate), 0) /
          dayProgression.length
        ).toFixed(1),
        dayComparison,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Loop5 day progression error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch day progression' },
      { status: 500 }
    );
  }
}
