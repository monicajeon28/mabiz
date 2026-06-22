/**
 * GET /api/cron/contact-token-refresh
 *
 * Contact Google Drive 백업 토큰 자동 갱신
 * - 모든 조직의 OAuth 토큰 일괄 갱신
 * - 실패 시 Slack 알림
 * - TTL 55분 기반 갱신
 *
 * Cron 스케줄: 매일 06:00 UTC (한국시간 15:00)
 * 설정: vercel.json
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { refreshAllOrganizationTokens } from '@/lib/contact-backup-google-drive';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  // Cron 인증 (Bearer Token)
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');

  if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // AbortSignal 타임아웃 55초 (안전 마진: 5초)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    logger.info('[GET /api/cron/contact-token-refresh] 시작');

    // 토큰 갱신 실행 (Promise.all 병렬 처리)
    const results = await refreshAllOrganizationTokens();

    clearTimeout(timeoutId);

    return NextResponse.json({
      ok: true,
      message: 'Contact 백업 토큰 갱신 완료',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    clearTimeout(timeoutId);

    logger.error('[GET /api/cron/contact-token-refresh]', err);

    return NextResponse.json(
      {
        ok: false,
        error: 'Cron 토큰 갱신 실패',
        message: err instanceof Error ? err.message : '',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/contact-token-refresh (수동 트리거)
 */
export async function POST(req: NextRequest) {
  // Cron 인증
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');

  if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('[POST /api/cron/contact-token-refresh] 수동 트리거');

    const results = await refreshAllOrganizationTokens();

    return NextResponse.json({
      ok: true,
      message: 'Contact 백업 토큰 갱신 완료',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[POST /api/cron/contact-token-refresh]', err);

    return NextResponse.json(
      {
        ok: false,
        error: 'Cron 토큰 갱신 실패',
        message: err instanceof Error ? err.message : '',
      },
      { status: 500 }
    );
  }
}
