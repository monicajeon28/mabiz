/**
 * app/api/admin/messages/[id]/resend/route.ts
 * 관리자용 메시지 재발송 API
 *
 * 기능:
 * 1. 실패/대기 중인 메시지 재발송
 * 2. 재시도 횟수 증가
 * 3. 중복 발송 방지 (트랜잭션)
 * 4. 상태 업데이트 (SENT 또는 WAITING)
 * 5. 에러 처리 (404, 409, 403)
 *
 * P0-4 Team B 구현
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  resendMessageSchema,
  type ResendMessageInput,
  type ResendResponse,
} from '@/lib/schemas/admin-control-schema';
import { multiChannelSender } from '@/lib/crm/multi-channel-sender';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<ResendResponse>> {
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
      logger.warn('[MESSAGES_RESEND] 비관리자 접근 시도', {
        userId: sessionUser.id,
        role: sessionUser.role,
        messageId: context.params.id,
        ip: request.ip,
      });
      return NextResponse.json(
        { ok: false, error: '관리자만 접근 가능합니다' },
        { status: 403 }
      );
    }

    // 3. 파라미터 파싱 및 검증
    const messageLogId = parseInt(context.params.id, 10);
    if (isNaN(messageLogId) || messageLogId <= 0) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 Message ID입니다' },
        { status: 400 }
      );
    }

    // 요청 바디에서 organizationId 추출
    const body = await request.json();
    const validated = await resendMessageSchema.parseAsync({
      messageLogId,
      organizationId: body.organizationId,
    });

    // 4. 메시지 로그 조회 (organizationId 포함)
    const log = await prisma.scheduledMessageLog.findUnique({
      where: { id: messageLogId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        ScheduledMessage: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!log) {
      logger.warn('[MESSAGES_RESEND] 메시지 로그 없음', {
        messageLogId,
        adminId: sessionUser.id,
      });
      return NextResponse.json(
        { ok: false, error: '메시지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // organizationId 소유권 검증 (IDOR 방지)
    if (log.organizationId !== validated.organizationId) {
      logger.warn('[MESSAGES_RESEND] 조직 불일치 (IDOR 시도)', {
        messageLogId,
        adminId: sessionUser.id,
        requestedOrg: validated.organizationId,
        actualOrg: log.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: '메시지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 5. 이미 발송됨 확인
    if (log.status === 'SENT') {
      logger.warn('[MESSAGES_RESEND] 이미 발송된 메시지', {
        messageLogId,
        adminId: sessionUser.id,
      });
      return NextResponse.json(
        { ok: false, error: '이미 발송된 메시지는 재발송할 수 없습니다' },
        { status: 409 }
      );
    }

    // 6. 트랜잭션: 재발송 처리
    const result = await prisma.$transaction(async (tx) => {
      // ScheduledMessageStage에서 메시지 내용 조회
      const stage = await tx.scheduledMessageStage.findFirst({
        where: {
          scheduledMessageId: log.ScheduledMessage.id,
          stageNumber: log.stageNumber,
        },
      });

      if (!stage) {
        throw new Error('Stage not found');
      }

      // multiChannelSender로 발송 시도
      const sendResult = await multiChannelSender.sendWithFallback(
        [
          {
            id: log.userId,
            phone: log.User?.phone,
            email: log.User?.email,
            name: log.User?.name,
          },
        ],
        stage.content,
        log.ScheduledMessage.id,
        'cascade'
      );

      const newRetryCount = (log.retryCount || 0) + 1;

      // 발송 성공 여부에 따라 상태 업데이트
      if (sendResult[0]?.totalSent) {
        // 성공: SENT 상태로 업데이트
        await tx.scheduledMessageLog.update({
          where: { id: messageLogId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            retryCount: newRetryCount,
            nextRetryAt: null,
          },
        });

        return {
          success: true,
          status: 'SENT',
          retryCount: newRetryCount,
          nextRetryAt: null,
        };
      } else {
        // 실패: WAITING 상태로 유지 (10분 후 재시도)
        const nextRetryAt = new Date(Date.now() + 10 * 60 * 1000);
        await tx.scheduledMessageLog.update({
          where: { id: messageLogId },
          data: {
            status: 'WAITING',
            retryCount: newRetryCount,
            nextRetryAt,
          },
        });

        return {
          success: false,
          status: 'WAITING',
          retryCount: newRetryCount,
          nextRetryAt,
        };
      }
    });

    logger.debug('[MESSAGES_RESEND] 재발송 성공', {
      messageLogId,
      organizationId: validated.organizationId,
      adminId: sessionUser.id,
      status: result.status,
      retryCount: result.retryCount,
    });

    const response: ResendResponse = {
      ok: true,
      data: {
        messageLogId,
        status: result.status,
        retryCount: result.retryCount,
        nextRetryAt: result.nextRetryAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[MESSAGES_RESEND] 재발송 오류', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      isDev: process.env.NODE_ENV === 'development',
    });

    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
