import { NextRequest, NextResponse } from 'next/server';
import { resumeMessagesSchema } from '@/lib/schemas/automation-log-schema';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();

    if (!user || !['admin', 'GLOBAL_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { organizationId, messageIds, note } = resumeMessagesSchema.parse(body);

    const adminId = user.id;

    // Transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Verify all messages are in paused state
      const messages = await tx.scheduledMessageLog.findMany({
        where: {
          id: {
            in: messageIds,
          },
          organizationId,
          status: 'paused',
        },
        select: {
          id: true,
        },
      });

      if (messages.length !== messageIds.length) {
        throw new Error(`Only ${messages.length} out of ${messageIds.length} messages are in paused state`);
      }

      // Update messages to pending/waiting status (whichever is appropriate)
      const updateResult = await tx.scheduledMessageLog.updateMany({
        where: {
          id: {
            in: messageIds,
          },
          organizationId,
          status: 'paused',
        },
        data: {
          status: 'waiting',
          pausedAt: null,
          pausedBy: null,
        },
      });

      // Log automation action
      await tx.automationLog.create({
        data: {
          organizationId,
          action: 'messages_resumed',
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

    logger.log('Messages resumed', {
      count: result.count,
      messageIds: messageIds.slice(0, 10),
      adminId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        resumed: result.count,
        total: messageIds.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Validation error in resume messages', {
        error: error.errors,
      });
      return NextResponse.json(
        { ok: false, error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      logger.warn('Resume messages partial failure', {
        error: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    logger.error('Error resuming messages', { error });
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
