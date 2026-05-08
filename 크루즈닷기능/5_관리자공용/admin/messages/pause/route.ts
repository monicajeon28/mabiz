import { NextRequest, NextResponse } from 'next/server';
import { pauseMessagesSchema } from '@/lib/schemas/automation-log-schema';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfToken } from '@/lib/csrf';
import { cookies } from 'next/headers';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // RAG: checkAdminAuth() 패턴 적용 (lib/auth.ts)
    // AGI (B0-B7): getSessionUser() + 수동 role 체크 → checkAdminAuth()로 통일
    const { isAdmin, user, error: authError } = await checkAdminAuth();
    if (!isAdmin || !user) {
      logger.warn('[Messages/Pause] 비인가 접근 시도', {
        errorType: authError,
        ip: request.headers.get('x-forwarded-for') ?? 'unknown',
      });
      return NextResponse.json(
        { ok: false, error: '관리자 인증이 필요합니다' },
        { status: 401 }
      );
    }

    // RAG: validateCsrfToken 패턴 적용 (app/api/trips/route.ts)
    // AGI: 상태변경 POST 요청 — CSRF 필수
    const csrfToken = request.headers.get('x-csrf-token');
    const cookieStore = await cookies();
    const sessionCsrfToken = cookieStore.get('csrf-token')?.value;
    if (!validateCsrfToken(sessionCsrfToken, csrfToken)) {
      logger.warn('[Messages/Pause] CSRF 토큰 검증 실패', { userId: user.id });
      return NextResponse.json(
        { ok: false, error: 'CSRF 토큰이 유효하지 않습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { organizationId, messageIds, note } = pauseMessagesSchema.parse(body);

    const adminId = user.id;
    const now = new Date();

    // Transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Verify all messages belong to the organization
      const messages = await tx.scheduledMessageLog.findMany({
        where: {
          id: {
            in: messageIds,
          },
          organizationId,
        },
        select: {
          id: true,
          status: true,
          sentAt: true,
        },
      });

      if (messages.length !== messageIds.length) {
        throw new Error('Some messages not found');
      }

      // Prevent pausing already-sent messages
      const sentMessages = messages.filter((m) => m.status === 'sent' || m.sentAt);
      if (sentMessages.length > 0) {
        throw new Error(`Cannot pause ${sentMessages.length} already-sent message(s)`);
      }

      // Update messages to paused status
      const updateResult = await tx.scheduledMessageLog.updateMany({
        where: {
          id: {
            in: messageIds,
          },
          organizationId,
          status: {
            notIn: ['sent', 'cancelled'],
          },
        },
        data: {
          status: 'paused',
          pausedAt: now,
          pausedBy: adminId,
        },
      });

      // Log automation action
      await tx.automationLog.create({
        data: {
          organizationId,
          action: 'messages_paused',
          actionDetails: {
            count: updateResult.count,
            messageIds: messageIds.slice(0, 100), // Log first 100 IDs
            note,
          },
          createdBy: adminId,
        },
      });

      return updateResult;
    });

    logger.log('Messages paused', {
      count: result.count,
      messageIds: messageIds.slice(0, 10),
      adminId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        paused: result.count,
        total: messageIds.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Validation error in pause messages', {
        error: error.errors,
      });
      return NextResponse.json(
        { ok: false, error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { ok: false, error: 'Some messages not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('already-sent')) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 409 }
        );
      }
    }

    logger.error('Error pausing messages', { error });
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
