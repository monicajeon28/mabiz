export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/cleanup-landing-views
 *
 * [T23] 24시간 이상 된 CrmLandingView 레코드 삭제
 * - IP 중복 방문 dedup 용도로만 사용하는 임시 레코드이므로 정기 정리 필요
 * - Vercel Cron 또는 외부 스케줄러에서 1일 1회 호출
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  // Cron 인증 — Vercel Cron Bearer token
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';

  if (!secret) {
    logger.error('[CRON] cleanup-landing-views 인증 실패', { reason: 'CRON_SECRET 환경변수 미설정' });
    return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 503 });
  }

  const expected = `Bearer ${secret}`;
  let authValid = false;
  try {
    authValid = auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    authValid = false;
  }

  if (!authValid) {
    logger.warn('[CRON] cleanup-landing-views 인증 실패', { ip: req.headers.get('x-forwarded-for') });
    return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
  }

  try {
    logger.log('[CRON] cleanup-landing-views 시작');

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간 전

    const deleted = await prisma.crmLandingView.deleteMany({
      where: {
        viewedAt: { lt: cutoff },
      },
    });

    logger.log(`[CRON] cleanup-landing-views 완료 — ${deleted.count}건 삭제`, {
      cutoff: cutoff.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: `${deleted.count}건 삭제 완료`,
      deletedCount: deleted.count,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    logger.error('[CRON] cleanup-landing-views 에러', { err });
    return NextResponse.json(
      { ok: false, message: '정리 작업 실패' },
      { status: 500 }
    );
  }
}
