import { NextRequest, NextResponse } from 'next/server';
import { cancelMessagesSchema } from '@/lib/schemas/automation-log-schema';
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
      logger.warn('[Messages/Cancel] 비인가 접근 시도', {
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
      logger.warn('[Messages/Cancel] CSRF 토큰 검증 실패', { userId: user.id });
      return NextResponse.json(
        { ok: false, error: 'CSRF 토큰이 유효하지 않습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { organizationId, messageIds, reason } = cancelMessagesSchema.parse(body);

    const adminId = user.id;
    const now = new Date();

    // Transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Verify all messages and check for already-sent ones
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

      // Prevent cancelling already-sent messages
      const sentMessages = messages.filter((m) => m.status === 'sent' || m.sentAt);
      if (sentMessages.length > 0) {
        return {
          error: 'CONFLICT',
          code: 409,
          message: `Cannot cancel ${sentMessages.length} already-sent message(s)`,
          cancelledCount: 0,
        };
      }

      // Update messages to cancelled status
      const updateResult = await tx.scheduledMessageLog.updateMany({
        where: {
          id: {
            in: messageIds,
          },
          organizationId,
          status: {
            notIn: ['sent'],
          },
        },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: adminId,
          cancelReason: reason,
        },
      });

      // Log automation action
      await tx.automationLog.create({
        data: {
          organizationId,
          action: 'messages_cancelled',
          actionDetails: {
            count: updateResult.count,
            messageIds: messageIds.slice(0, 100), // Log first 100 IDs
            reason,
          },
          createdBy: adminId,
        },
      });

      return {
        error: null,
        cancelledCount: updateResult.count,
      };
    });

    if (result.error === 'CONFLICT') {
      return NextResponse.json(
        { ok: false, error: result.message },
        { status: result.code }
      );
    }

    logger.log('Messages cancelled', {
      count: result.cancelledCount,
      messageIds: messageIds.slice(0, 10),
      reason,
      adminId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        cancelled: result.cancelledCount,
        total: messageIds.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Validation error in cancel messages', {
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
    }

    logger.error('Error cancelling messages', { error });
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
