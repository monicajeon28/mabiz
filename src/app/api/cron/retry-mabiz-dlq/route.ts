export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { getPendingDLQEntries, retryDLQEntriesBatch } from '@/lib/mabiz-dlq';

/**
 * GET /api/cron/retry-mabiz-dlq
 * Vercel Cron (매 5분) — DLQ 재시도
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      logger.warn('[CronDLQ] CRON_SECRET 미설정');
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    // [보안] Vercel Cron 인증
    // Vercel은 authorization: Bearer <CRON_SECRET> 형식으로 요청
    // 참고: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
    // P0-8: timingSafeEqual로 타이밍 공격 방지
    // P1-9: Vercel 문서와 일치 확인 완료 (2026-02-27)
    const expectedSecret = Buffer.from(`Bearer ${secret}`);
    const providedSecret = Buffer.from(auth);

    if (
      expectedSecret.length !== providedSecret.length ||
      !timingSafeEqual(expectedSecret, providedSecret)
    ) {
      logger.warn('[CronDLQ] Cron 인증 실패');
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  // [동시성 보호] 재시도 항목 조회 + PROCESSING 상태 변경 (트랜잭션 내 원자적)
  // P1-10 해결: Vercel Cron 멀티 인스턴스 동시성 문제
  // - getPendingDLQEntries()는 Prisma RepeatableRead 트랜잭션 사용
  // - SELECT + UPDATE가 원자적으로 실행되어 중복 처리 방지
  // - 다른 Cron 인스턴스는 PROCESSING 상태인 항목을 선택할 수 없음
  const entries = await getPendingDLQEntries();
  if (entries.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  logger.log('[CronDLQ] 재시도 시작', { count: entries.length });

  // [성능] 5개씩 동시 처리 (Promise.allSettled로 부분 실패 대응)
  const { resolved, failed } = await retryDLQEntriesBatch(entries, 5);

  // 웹훅 타입별 통계 계산
  // retryDLQEntriesBatch는 집계 총계(resolved/failed)만 반환하므로
  // 타입별 처리 건수를 집계하고, 전체 성공률을 비례 배분한다.
  const byTypeTotal: Record<string, number> = {};
  for (const entry of entries) {
    byTypeTotal[entry.webhookType] = (byTypeTotal[entry.webhookType] ?? 0) + 1;
  }
  const successRatio = entries.length > 0 ? resolved / entries.length : 0;
  const byType: Record<string, { total: number; success: number; failed: number }> = {};
  for (const [type, total] of Object.entries(byTypeTotal)) {
    const typeSuccess = Math.round(total * successRatio);
    byType[type] = { total, success: typeSuccess, failed: total - typeSuccess };
  }

  logger.log('[CronDLQ] 배치 완료', {
    resolved,
    failed,
    total: entries.length,
    successRate: `${((resolved / entries.length) * 100).toFixed(2)}%`,
    byType,
  });
  return NextResponse.json({ ok: true, processed: entries.length, resolved, failed });
}
