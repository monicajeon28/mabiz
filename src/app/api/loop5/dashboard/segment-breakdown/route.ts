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

const SEGMENT_MAPPING: Record<string, string> = {
  'A': '신혼부부',
  'B': '가족',
  'C': '중년',
  'D': 'VVIP',
  'E': '70s+',
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const organizationId = searchParams.get('organizationId');

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: 'fromDate and toDate are required' },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // contacts 테이블에서 segment 정보 조회 (서버 측 필터링)
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id, segment')
      .in('segment', ['A', 'B', 'C', 'D', 'E'])
      .eq('organization_id', organizationId);

    if (contactError) throw contactError;

    // sms_logs와 contact segment 결합 (서버 측 필터링)
    const { data: smsLogs, error: smsError } = await supabase
      .from('sms_logs')
      .select('id, contact_id, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (smsError) throw smsError;

    // campaign_events와 contact segment 결합 (서버 측 필터링)
    const { data: campaignEvents, error: eventError } = await supabase
      .from('campaign_events')
      .select('id, contact_id, event_type, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (eventError) throw eventError;

    // Segment별 집계
    const segmentStats: Record<string, any> = {};

    Object.keys(SEGMENT_MAPPING).forEach(segment => {
      const contactIds = contacts
        ?.filter(c => c.segment === segment)
        .map(c => c.id) || [];

      const segmentSent = smsLogs?.filter(log =>
        contactIds.includes(log.contact_id)
      ).length || 0;

      const segmentClicked = campaignEvents?.filter(
        e => contactIds.includes(e.contact_id) && e.event_type === 'LINK_CLICKED'
      ).length || 0;

      const segmentSubmitted = campaignEvents?.filter(
        e => contactIds.includes(e.contact_id) && e.event_type === 'FORM_SUBMITTED'
      ).length || 0;

      const responseRate = segmentSent > 0 ? (segmentClicked / segmentSent) * 100 : 0;
      const completionRate = segmentClicked > 0 ? (segmentSubmitted / segmentClicked) * 100 : 0;
      const estimatedRevenue = segmentSubmitted * 8.25;

      segmentStats[segment] = {
        name: SEGMENT_MAPPING[segment],
        sent: segmentSent,
        clicked: segmentClicked,
        submitted: segmentSubmitted,
        responseRate: Math.round(responseRate * 10) / 10,
        formCompletionRate: Math.round(completionRate * 10) / 10,
        estimatedRevenue: Math.round(estimatedRevenue),
        trend: responseRate > 35 ? 'up' : responseRate < 30 ? 'down' : 'stable',
      };
    });

    // 합계 계산
    const totalSent = Object.values(segmentStats).reduce((sum: number, s: any) => sum + s.sent, 0);
    const totalClicked = Object.values(segmentStats).reduce((sum: number, s: any) => sum + s.clicked, 0);
    const totalSubmitted = Object.values(segmentStats).reduce((sum: number, s: any) => sum + s.submitted, 0);

    const segments = Object.entries(segmentStats).map(([key, stats]) => ({
      key,
      ...stats,
    }));

    segments.push({
      key: 'TOTAL',
      name: '합계',
      sent: totalSent,
      clicked: totalClicked,
      submitted: totalSubmitted,
      responseRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 1000) / 10 : 0,
      formCompletionRate: totalClicked > 0 ? Math.round((totalSubmitted / totalClicked) * 1000) / 10 : 0,
      estimatedRevenue: Math.round(totalSubmitted * 8.25),
      trend: 'neutral',
    });

    return NextResponse.json({
      segments,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Loop5 segment breakdown error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segment breakdown' },
      { status: 500 }
    );
  }
}
