/**
 * Live Stream Statistics API
 * GET /api/admin/live-stream-stats?date=2026-06-02
 *
 * 라이브방송 성과 통계 (관리자용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { getLiveStreamStats, generateLiveStreamWeeklyReport } from '@/lib/live-stream/tracking';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session || session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const reportType = searchParams.get('type') || 'stats'; // 'stats' or 'report'

    if (reportType === 'report') {
      // 주간 리포트
      const report = await generateLiveStreamWeeklyReport(date);
      return NextResponse.json({
        success: true,
        report,
      });
    }

    // 실시간 통계
    const stats = await getLiveStreamStats(date);

    return NextResponse.json({
      success: true,
      stats,
      metadata: {
        date,
        timestamp: new Date().toISOString(),
        nextAction: 'Day 1 콜 시작',
      },
    });
  } catch (error) {
    logger.error('[LIVE_STREAM_STATS]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
