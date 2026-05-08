// app/api/admin/messages/logs/route.ts
// 관리자용 메시지 발송 로그 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  getMessagesLogsSchema,
  type GetMessagesLogsInput,
  type MessageLogEntry,
  type MessageLogsResponse,
} from '@/lib/schemas/admin-message-schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<MessageLogsResponse>> {
  try {
    // 1. 인증 확인
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. 관리자 권한 확인 (관리자 역할만 접근 가능)
    if (sessionUser.role !== 'GLOBAL_ADMIN' && sessionUser.role !== 'admin') {
      logger.warn('[MESSAGES_LOGS] 비관리자 접근 시도', {
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
    const validated = await getMessagesLogsSchema.parseAsync(queryParams);

    // 4. 필터 조건 구성
    const where: any = {
      organizationId: validated.organizationId,
    };

    if (validated.status) {
      where.status = validated.status;
    }

    if (validated.channel) {
      where.channel = validated.channel;
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

    // 5. 검색 (이름/전화)
    if (validated.search) {
      where.User = {
        OR: [
          { name: { contains: validated.search, mode: 'insensitive' } },
          { phone: { contains: validated.search } },
        ],
      };
    }

    // 6. 페이지네이션
    const skip = (validated.page - 1) * validated.limit;
    const take = validated.limit;

    // 7. 병렬로 로그 조회 및 총 개수 조회 (N+1 방지: include 사용)
    const [logs, total] = await Promise.all([
      prisma.scheduledMessageLog.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          ScheduledMessage: {
            select: {
              startDate: true,
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take,
      }),
      prisma.scheduledMessageLog.count({ where }),
    ]);

    // 8. 응답 포맷 구성
    const logEntries: MessageLogEntry[] = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      name: log.User?.name || 'Unknown',
      phone: log.User?.phone || '-',
      status: log.status as 'PENDING' | 'WAITING' | 'SENT' | 'FAILED',
      channel: log.channel || 'Unknown',
      sentAt: log.sentAt,
      scheduledAt: log.ScheduledMessage?.startDate || new Date(),
      stageNumber: log.stageNumber,
      errorMessage: log.errorMessage,
    }));

    const response: MessageLogsResponse = {
      ok: true,
      data: {
        logs: logEntries,
        pagination: {
          page: validated.page,
          limit: validated.limit,
          total,
          hasMore: skip + logs.length < total,
        },
      },
    };

    logger.debug('[MESSAGES_LOGS] 조회 성공', {
      adminId: sessionUser.id,
      organizationId: validated.organizationId,
      logCount: logEntries.length,
      total,
      filters: {
        status: validated.status,
        channel: validated.channel,
        search: validated.search ? '[REDACTED]' : undefined,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[MESSAGES_LOGS] 조회 오류', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      isDev: process.env.NODE_ENV === 'development',
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
