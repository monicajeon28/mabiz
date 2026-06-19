/**
 * APIS Sync Queue Cron Handler
 * GmApisSyncQueue 테이블의 대기 중인 작업을 처리합니다.
 *
 * Vercel Cron: vercel.json crons에 path="/api/cron/apis-sync" schedule="every 5 min" 등록
 * 수동 호출: GET /api/cron/apis-sync  (Authorization: Bearer <CRON_SECRET> 헤더 필수)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processApisSyncQueue } from '@/lib/apis/apis-sync-queue';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    // Vercel Cron 서명 헤더 검증 (Vercel이 자동으로 Authorization: Bearer <secret> 주입)
    const isVercelCron =
      token.length === cronSecret.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));

    // 수동 호출도 동일한 Authorization Bearer 헤더 방식 사용
    const isAuthorized = isVercelCron;

    if (!isAuthorized) {
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
