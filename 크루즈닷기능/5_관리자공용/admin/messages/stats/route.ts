/**
 * app/api/admin/messages/stats/route.ts
 * 관리자용 메시지 발송 통계 API
 *
 * 기능:
 * 1. 전체 발송 통계 (total, sent, failed, pending)
 * 2. 채널별 통계 (SMS, Email, Kakao)
 * 3. 상태별 통계 (PENDING, WAITING, SENT, FAILED)
 * 4. 실패 사유 분석 (TOP 5)
 * 5. 날짜 범위 필터링 (startDate, endDate)
 *
 * P0-4 Team B 구현
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  getStatsSchema,
  type GetStatsInput,
  type MessageStats,
  type StatsResponse,
} from '@/lib/schemas/admin-control-schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<StatsResponse>> {
  try {
    // 1. 인증 확인
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. 관리자 권한 확인
    if (sessionUser.role !== 'GLOBAL_ADMIN' && sessionUser.role !== 'admin') {
      logger.warn('[MESSAGES_STATS] 비관리자 접근 시도', {
        userId: sessionUser.id,
        role: sessionUser.role,
        ip: request.ip,
      });
      return NextResponse.json(
        { ok: false, error: '관리자만 접근 가능합니다' },
        { status: 403 }
      );
    }

    // 3. 쿼리 파라미터 추출 및 검증
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validated = await getStatsSchema.parseAsync(queryParams);

    // 4. 필터 조건 구성
    const where: any = {};

    // organizationId 필터 추가 (필수)
    if (validated.organizationId) {
      where.organizationId = validated.organizationId;
    }

    if (validated.startDate || validated.endDate) {
      where.sentAt = {};
      if (validated.startDate) {
        where.sentAt.gte = new Date(validated.startDate);
      }
      if (validated.endDate) {
        where.sentAt.lte = new Date(validated.endDate);
      }
    }

    // 5. 상태별 통계를 groupBy로 한 번에 조회 (5개 count → 1개 쿼리)
    const statusCounts = await prisma.scheduledMessageLog.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const statusMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>
    );

    const total = statusCounts.reduce((sum, item) => sum + item._count, 0);
    const sent = statusMap['SENT'] || 0;
    const failed = statusMap['FAILED'] || 0;
    const pendingCount = statusMap['PENDING'] || 0;
    const waitingCount = statusMap['WAITING'] || 0;

    // 6. 실패 사유별 통계 (TOP 5)
    const topFailures = await prisma.scheduledMessageLog.groupBy({
      by: ['errorMessage'],
      where: { ...where, status: 'FAILED' },
      _count: true,
      orderBy: { _count: 'desc' },
      take: 5,
    });

    const topFailureReasons = topFailures
      .filter((x) => x.errorMessage)
      .map((x) => ({
        reason: x.errorMessage || 'Unknown',
        count: x._count,
      }));

    // 7. B0-C6: 채널별 통계 — findMany(1000)+클라이언트집계 대신 groupBy로 DB 집계
    // ScheduledMessageLog.channel 컬럼 추가 마이그레이션 후 사용 가능
    const channelGroupBy = await prisma.scheduledMessageLog.groupBy({
      by: ['channel'],
      where,
      _count: true,
    });

    const channelCounts = {
      sms: 0,
      email: 0,
      kakao: 0,
    };

    channelGroupBy.forEach((row) => {
      const ch = row.channel?.toLowerCase();
      if (ch === 'sms' || ch === 'email' || ch === 'kakao') {
        channelCounts[ch] += row._count;
      }
    });

    // 8. 성공률 계산
    const successRate =
      total > 0 ? ((sent / total) * 100).toFixed(2) : '0.00';

    // 9. 응답 구성
    const stats: MessageStats = {
      total,
      sent,
      failed,
      pending: pendingCount,
      waiting: waitingCount,
      successRate,
      byChannel: channelCounts,
      byStatus: {
        PENDING: pendingCount,
        WAITING: waitingCount,
        SENT: sent,
        FAILED: failed,
      },
      topFailureReasons,
    };

    logger.debug('[MESSAGES_STATS] 조회 성공', {
      adminId: sessionUser.id,
      total,
      sent,
      failed,
      filters: {
        startDate: validated.startDate ? '[REDACTED]' : undefined,
        endDate: validated.endDate ? '[REDACTED]' : undefined,
      },
    });

    const response: StatsResponse = {
      ok: true,
      data: stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn('[MESSAGES_STATS] 검증 오류', {
        error: '잘못된 필터 매개변수',
      });
      return NextResponse.json(
        { ok: false, error: '잘못된 파라미터입니다' },
        { status: 400 }
      );
    }

    logger.error('[MESSAGES_STATS] 조회 오류', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      isDev: process.env.NODE_ENV === 'development',
    });

    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
