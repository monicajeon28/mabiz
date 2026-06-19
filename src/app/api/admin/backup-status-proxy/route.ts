export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import { unauthorized } from '@/lib/response';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/backup-status-proxy
 *
 * Server-side proxy for /api/cron/health-check.
 * Requires GLOBAL_ADMIN session — never exposes CRON_SECRET to the client.
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error('[backup-status-proxy] CRON_SECRET 미설정');
      return NextResponse.json({ ok: false, message: '서버 설정 오류입니다.' }, { status: 503 });
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/cron/health-check`, {
      headers: { 'x-cron-secret': secret },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return unauthorized('인증이 필요합니다.');
    logger.error('[backup-status-proxy] 오류', { err });
    return NextResponse.json({ ok: false, message: '헬스체크 실패' }, { status: 500 });
  }
}
