/**
 * GET /api/sync/dlq-status
 * SyncDeadLetterQueue 현황 조회 (관리자 전용)
 *
 * 응답:
 * {
 *   stats: { pending: 3, failed: 1, resolved: 42, total: 46 },
 *   pending: [...],   // 재시도 대기 중
 *   failed: [...]     // 최대 재시도 초과 (수동 처리 필요)
 * }
 */

import { NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getMabizSession();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });
  }

  // 상태별 통계
  const [pending, failed, resolved] = await Promise.all([
    prisma.syncDeadLetterQueue.count({ where: { status: 'PENDING' } }),
    prisma.syncDeadLetterQueue.count({ where: { status: 'FAILED' } }),
    prisma.syncDeadLetterQueue.count({ where: { status: 'RESOLVED' } }),
  ]);

  // PENDING 목록 (다음 재시도 임박 순)
  const pendingItems = await prisma.syncDeadLetterQueue.findMany({
    where: { status: 'PENDING' },
    orderBy: { nextRetryAt: 'asc' },
    take: 20,
    select: {
      id: true,
      syncType: true,
      tableName: true,
      recordId: true,
      error: true,
      retryCount: true,
      maxRetries: true,
      nextRetryAt: true,
      createdAt: true,
    },
  });

  // FAILED 목록 (최근 실패 순)
  const failedItems = await prisma.syncDeadLetterQueue.findMany({
    where: { status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      syncType: true,
      tableName: true,
      recordId: true,
      error: true,
      retryCount: true,
      maxRetries: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    stats: {
      pending,
      failed,
      resolved,
      total: pending + failed + resolved,
    },
    pending: pendingItems,
    failed: failedItems,
    // 즉시 재시도 가능 여부 (nextRetryAt이 현재 시간 이전인 항목)
    retryReady: pendingItems.filter(i => new Date(i.nextRetryAt) <= new Date()).length,
  });
}
