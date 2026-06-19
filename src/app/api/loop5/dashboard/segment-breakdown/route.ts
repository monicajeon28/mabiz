import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { getMabizSession } from '@/lib/auth';

const SEGMENT_MAPPING: Record<string, string> = {
  'A': '신혼부부',
  'B': '가족',
  'C': '중년',
  'D': 'VVIP',
  'E': '70s+',
};

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase 설정 오류' }, { status: 503 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 인증 검증 — 미인증 요청 차단 (IDOR 방지)
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: 'fromDate and toDate are required' },
        { status: 400 }
      );
    }

    // GLOBAL_ADMIN만 쿼리파라미터로 org 선택 가능, 일반 사용자는 자신의 org만
    const organizationId = ctx.role === 'GLOBAL_ADMIN'
      ? (searchParams.get('organizationId') || ctx.organizationId || '')
      : (ctx.organizationId || '');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // DB 함수 호출 (모든 계산을 데이터베이스에서 처리)
    const { data: segmentStats, error: rpcError } = await supabase.rpc(
      'get_segment_stats',
      {
        p_org_id: organizationId,
        p_from_date: fromDate,
        p_to_date: toDate,
      }
    );

    if (rpcError) {
      logger.error('RPC get_segment_stats error:', rpcError);
      throw rpcError;
    }

    if (!segmentStats || segmentStats.length === 0) {
      return NextResponse.json({
        segments: Object.keys(SEGMENT_MAPPING).map(key => ({
          key,
          name: SEGMENT_MAPPING[key],
          sent: 0,
          clicked: 0,
          submitted: 0,
          responseRate: 0,
          formCompletionRate: 0,
          estimatedRevenue: 0,
          trend: 'stable',
        })).concat({
          key: 'TOTAL',
          name: '합계',
          sent: 0,
          clicked: 0,
          submitted: 0,
          responseRate: 0,
          formCompletionRate: 0,
          estimatedRevenue: 0,
          trend: 'neutral',
        }),
        lastUpdated: new Date().toISOString(),
        performanceMs: Date.now() - startTime,
      });
    }

    // 합계 계산
    const totalSent = segmentStats.reduce((sum: number, s: any) => sum + (s.sent_count || 0), 0);
    const totalClicked = segmentStats.reduce((sum: number, s: any) => sum + (s.clicked_count || 0), 0);
    const totalSubmitted = segmentStats.reduce((sum: number, s: any) => sum + (s.submitted_count || 0), 0);

    const segments = segmentStats.map((s: any) => ({
      key: s.segment,
      name: s.segment_name,
      sent: s.sent_count,
      clicked: s.clicked_count,
      submitted: s.submitted_count,
      responseRate: Number(s.response_rate || 0),
      formCompletionRate: Number(s.completion_rate || 0),
      estimatedRevenue: Math.round(s.estimated_revenue || 0),
      trend: s.response_rate > 35 ? 'up' : s.response_rate < 30 ? 'down' : 'stable',
    }));

    // 합계 행 추가
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

    const elapsedMs = Date.now() - startTime;
    logger.log(`[SegmentBreakdown] Completed in ${elapsedMs}ms`, {
      segmentCount: segmentStats.length,
      totalSent,
      totalClicked,
      totalSubmitted,
    });

    return NextResponse.json({
      segments,
      lastUpdated: new Date().toISOString(),
      performanceMs: elapsedMs,
    });
  } catch (error: unknown) {
    logger.error('Loop5 segment breakdown error:', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch segment breakdown' },
      { status: 500 }
    );
  }
}
