/**
 * POST /api/sync/retry-dlq
 * SyncDeadLetterQueue의 PENDING 항목을 재시도
 *
 * 요청:
 * {
 *   "ids": ["dlq_id_1", "dlq_id_2"],  // 특정 DLQ 항목만 재시도 (선택)
 *   "all": true                        // 모든 PENDING 항목 재시도 (선택)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import pg from 'pg';

const { Client: PgClient } = pg;

export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();

    // GLOBAL_ADMIN만 접근 가능
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });
    }

    const body = await req.json() as { ids?: string[]; all?: boolean };
    const { ids, all } = body;

    // DLQ 항목 조회
    let dlqItems;

    if (all) {
      // 모든 PENDING 항목
      dlqItems = await prisma.syncDeadLetterQueue.findMany({
        where: {
          status: 'PENDING',
          nextRetryAt: { lte: new Date() },
        },
        orderBy: { nextRetryAt: 'asc' },
      });
    } else if (ids && ids.length > 0) {
      // 특정 DLQ 항목
      dlqItems = await prisma.syncDeadLetterQueue.findMany({
        where: {
          id: { in: ids },
        },
      });
    } else {
      return NextResponse.json({
        ok: false,
        error: '"ids" 배열 또는 "all": true 필요',
      }, { status: 400 });
    }

    if (dlqItems.length === 0) {
      return NextResponse.json({
        ok: true,
        message: '재시도할 항목 없음',
        retried: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    const supabaseUrl = process.env.SUPABASE_BACKUP_URL;
    if (!supabaseUrl) {
      return NextResponse.json({
        ok: false,
        error: 'SUPABASE_BACKUP_URL 환경변수 없음',
      }, { status: 500 });
    }

    const supabaseClient = new PgClient({ connectionString: supabaseUrl });
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      await supabaseClient.connect();
      logger.log('[DLQ-Retry] Supabase 연결 성공');

      // 각 DLQ 항목 재시도
      for (const dlq of dlqItems) {
        try {
          const userData = dlq.data as any;

          // Supabase에 동기화 시도
          await supabaseClient.query(`
            INSERT INTO "User" (
              id, phone, password, name, role, email, "mallUserId", "isLocked",
              "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              phone = $2,
              password = $3,
              name = $4,
              role = $5,
              email = $6,
              "isLocked" = $8,
              "updatedAt" = NOW()
          `, [
            dlq.recordId,
            userData.partnerId || userData.phone,
            userData.password || userData.passwordHash,
            userData.name,
            userData.role || 'community',
            userData.email || null,
            null,
            false,
          ]);

          // 성공 → DLQ 상태 업데이트
          await prisma.syncDeadLetterQueue.update({
            where: { id: dlq.id },
            data: {
              status: 'RESOLVED',
              resolvedAt: new Date(),
            },
          });

          succeeded++;
          logger.log('[DLQ-Retry] 재시도 성공', { dlqId: dlq.id, recordId: dlq.recordId });
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`DLQ ${dlq.id}: ${msg}`);

          // 실패 → 재시도 횟수 증가
          const newRetryCount = dlq.retryCount + 1;
          if (newRetryCount >= dlq.maxRetries) {
            // 최대 재시도 횟수 초과 → FAILED로 표시
            await prisma.syncDeadLetterQueue.update({
              where: { id: dlq.id },
              data: {
                status: 'FAILED',
                retryCount: newRetryCount,
              },
            });
            logger.error('[DLQ-Retry] 최대 재시도 초과', {
              dlqId: dlq.id,
              recordId: dlq.recordId,
              retryCount: newRetryCount,
            });
          } else {
            // 다음 재시도 스케줄 설정 (지수 백오프: 5분, 10분, 20분, 40분, 80분)
            const backoffMinutes = 5 * Math.pow(2, newRetryCount);
            await prisma.syncDeadLetterQueue.update({
              where: { id: dlq.id },
              data: {
                retryCount: newRetryCount,
                nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
              },
            });
            logger.warn('[DLQ-Retry] 재시도 실패 — 다음 스케줄 설정', {
              dlqId: dlq.id,
              recordId: dlq.recordId,
              nextRetryMinutes: backoffMinutes,
              error: msg,
            });
          }
        }
      }
    } finally {
      await supabaseClient.end();
    }

    logger.log('[DLQ-Retry] 완료', {
      retried: dlqItems.length,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });

    return NextResponse.json({
      ok: true,
      message: `${succeeded}건 복구, ${failed}건 실패`,
      retried: dlqItems.length,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    logger.error('[DLQ-Retry]', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      ok: false,
      error: 'DLQ 재시도 실패',
    }, { status: 500 });
  }
}
