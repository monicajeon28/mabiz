import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // 날짜 범위를 ISO 형식으로 정규화 (INDEX 활용)
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    // sms_logs 테이블에서 데이터 조회 (범위 쿼리로 INDEX 활용)
    const { data: smsLogs, error: smsError } = await supabase
      .from('sms_logs')
      .select('id, created_at, response_type, sent_date, contact_id')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true });

    if (smsError) throw smsError;

    // CRM campaign_events 테이블에서 클릭/폼 제출 데이터 (범위 쿼리)
    const { data: campaignEvents, error: eventError } = await supabase
      .from('campaign_events')
      .select('id, event_type, created_at, contact_id')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .in('event_type', ['LINK_CLICKED', 'FORM_SUBMITTED'])
      .order('created_at', { ascending: true });

    if (eventError) throw eventError;

    // 집계 계산
    const totalSent = smsLogs?.length || 0;
    const totalClicked = campaignEvents?.filter(e => e.event_type === 'LINK_CLICKED').length || 0;
    const totalFormSubmitted = campaignEvents?.filter(e => e.event_type === 'FORM_SUBMITTED').length || 0;

    const responseRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const formCompletionRate = totalClicked > 0 ? (totalFormSubmitted / totalClicked) * 100 : 0;
    const estimatedRevenue = totalFormSubmitted * 8.25; // 평균 $8.25

    // Day별 분석 (메모리 기반 필터링 - 이미 조회된 데이터 활용)
    const dayStats: Record<number, any> = {};
    for (let d = 0; d <= 7; d++) {
      const dayStart = new Date(from);
      dayStart.setDate(dayStart.getDate() + d);
      const dayStartStr = dayStart.toISOString().split('T')[0];

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayEndStr = dayEnd.toISOString().split('T')[0];

      // 이미 로드된 배열에서 필터링 (날짜 범위 기반)
      const daySent = smsLogs?.filter(
        log => log.created_at >= dayStart.toISOString() && log.created_at < dayEnd.toISOString()
      ).length || 0;

      const dayClicked = campaignEvents?.filter(
        e => e.created_at >= dayStart.toISOString() && e.created_at < dayEnd.toISOString() && e.event_type === 'LINK_CLICKED'
      ).length || 0;

      const daySubmitted = campaignEvents?.filter(
        e => e.created_at >= dayStart.toISOString() && e.created_at < dayEnd.toISOString() && e.event_type === 'FORM_SUBMITTED'
      ).length || 0;

      dayStats[d] = {
        sent: daySent,
        clicked: dayClicked,
        submitted: daySubmitted,
        rate: daySent > 0 ? (dayClicked / daySent) * 100 : 0,
        completionRate: dayClicked > 0 ? (daySubmitted / dayClicked) * 100 : 0,
      };
    }

    // 트렌드 계산 (지난주 vs 이번주)
    const prevWeekStart = new Date(from);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekStartIso = prevWeekStart.toISOString();

    const { data: prevWeekSms } = await supabase
      .from('sms_logs')
      .select('id')
      .gte('created_at', prevWeekStartIso)
      .lt('created_at', fromIso);

    const { data: prevWeekEvents } = await supabase
      .from('campaign_events')
      .select('id, event_type')
      .gte('created_at', prevWeekStartIso)
      .lt('created_at', fromIso)
      .in('event_type', ['LINK_CLICKED', 'FORM_SUBMITTED']);

    const prevWeekClicked = prevWeekEvents?.filter(e => e.event_type === 'LINK_CLICKED').length || 0;
    const prevWeekSubmitted = prevWeekEvents?.filter(e => e.event_type === 'FORM_SUBMITTED').length || 0;

    const prevResponseRate =
      (prevWeekSms?.length || 0) > 0
        ? (prevWeekClicked / (prevWeekSms?.length || 1)) * 100
        : 0;

    const responseRateChange = responseRate - prevResponseRate;

    const prevFormCompletionRate =
      prevWeekClicked > 0
        ? (prevWeekSubmitted / prevWeekClicked) * 100
        : 0;

    const formCompletionChange = formCompletionRate - prevFormCompletionRate;
    const revenueChange = ((estimatedRevenue - (totalFormSubmitted * 0.75 * 8.25)) / (totalFormSubmitted * 0.75 * 8.25 || 1)) * 100;

    return NextResponse.json({
      totalSent,
      totalClicked,
      totalFormSubmitted,
      responseRate: Math.round(responseRate * 10) / 10,
      formCompletionRate: Math.round(formCompletionRate * 10) / 10,
      estimatedRevenue: Math.round(estimatedRevenue),
      byDay: dayStats,
      trends: {
        responseRateChange: Math.round(responseRateChange * 10) / 10,
        formCompletionChange: Math.round(formCompletionChange * 10) / 10,
        revenueChange: Math.round(revenueChange * 10) / 10,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Loop5 stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
