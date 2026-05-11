/**
 * APIS Sync Queue Cron Handler
 * GmApisSyncQueue 테이블의 대기 중인 작업을 처리합니다.
 *
 * Vercel Cron: vercel.json crons에 path="/api/cron/apis-sync" schedule="every 5 min" 등록
 * 수동 호출: GET /api/cron/apis-sync?secret=CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { processApisSyncQueue } from '@/lib/apis/apis-sync-queue';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 인증 또는 시크릿 키 검증
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const urlSecret = request.nextUrl.searchParams.get('secret');

    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isManualCall = urlSecret === cronSecret;

    if (!isVercelCron && !isManualCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.log('[Cron:apis-sync] Processing queue...');

    await processApisSyncQueue(10);

    return NextResponse.json({
      ok: true,
      message: 'APIS sync queue processed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Cron:apis-sync] Error:', error instanceof Error ? { message: error.message } : undefined);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
