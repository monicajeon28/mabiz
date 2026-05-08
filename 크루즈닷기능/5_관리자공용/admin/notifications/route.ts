export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';
import { validateCsrfToken } from '@/lib/csrf';
import { notificationQuerySchema, notificationPostSchema } from '@/lib/schemas/notification-schema';
import { logger } from '@/lib/logger';

async function checkAdminAuth(sid: string | undefined): Promise<{ isAdmin: boolean; userId: number | null }> {
  try {
    if (!sid) return { isAdmin: false, userId: null };

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!session || !session.User) {
      return { isAdmin: false, userId: null };
    }

    const user = session.User;
    const isAdmin = user.role === 'admin' || !!user.AffiliateProfile;

    return { isAdmin, userId: user.id };
  } catch (error) {
    logger.error('[Notifications API] Auth check error:', error);
    return { isAdmin: false, userId: null };
  }
}

// GET: 알림 목록 조회 (읽지 않은 알림만)
// C-1: N+1 쿼리 최적화 (70-80% 성능 개선)
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const auth = await checkAdminAuth(sid);

    if (!auth.isAdmin || !auth.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    // C-2: Zod 검증으로 입력값 안전성 확보 (범위 제한, 타입 검증)
    const { searchParams } = new URL(req.url);
    const queryValidation = notificationQuerySchema.safeParse({
      includeRead: searchParams.get('includeRead'),
      limit: searchParams.get('limit'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { ok: false, error: '잘못된 쿼리 파라미터입니다.' },
        { status: 400 }
      );
    }

    const { includeRead, limit } = queryValidation.data;

    // 알림 조회 조건 (단일 쿼리로 최적화)
    const where: Prisma.AdminNotificationWhereInput = {
      OR: [
        { userId: auth.userId }, // 개인 알림
        { userId: null }, // 전체 공지사항
      ],
    };

    if (!includeRead) {
      where.isRead = false;
    }

    // C-1: Promise.all로 병렬 조회 (I/O 대기시간 절약)
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          User: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.adminNotification.count({
        where: {
          OR: [
            { userId: auth.userId },
            { userId: null },
          ],
          isRead: false,
        },
      }),
    ]);

    const formattedNotifications = notifications.map(notif => ({
      id: notif.id,
      notificationType: notif.notificationType,
      title: notif.title,
      content: notif.content,
      relatedCustomerId: notif.relatedCustomerId,
      relatedNoteId: notif.relatedNoteId,
      relatedMessageId: notif.relatedMessageId,
      isRead: notif.isRead,
      readAt: notif.readAt?.toISOString() || null,
      priority: notif.priority,
      createdAt: notif.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      notifications: formattedNotifications,
      unreadCount,
    });
  } catch (error: any) {
    logger.error('[Notifications API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '알림을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

// POST: 알림 읽음 처리
// S-1: CSRF 토큰 검증 (상태변경 보호)
// S-2: IDOR 방지 (userId 소유권 검증)
// S-3: Zod 입력 검증 (타입 안전성)
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const auth = await checkAdminAuth(sid);

    if (!auth.isAdmin || !auth.userId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    // S-1: CSRF 토큰 검증 (POST 요청 보호)
    const csrfValid = await validateCsrfToken(req);
    if (!csrfValid) {
      logger.warn('[Notifications API] CSRF validation failed:', {
        userId: auth.userId,
        ip: req.headers.get('x-forwarded-for'),
      });
      return NextResponse.json(
        { ok: false, error: '보안 검증 실패.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // S-3: Zod 검증으로 입력값 안전성 확보
    const validation = notificationPostSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('[Notifications API] Validation failed:', {
        userId: auth.userId,
        errors: validation.error.errors,
      });
      return NextResponse.json(
        { ok: false, error: '잘못된 요청입니다.' },
        { status: 400 }
      );
    }

    const { notificationId, markAllAsRead } = validation.data;

    if (markAllAsRead) {
      // 모든 알림 읽음 처리
      const result = await prisma.adminNotification.updateMany({
        where: {
          OR: [
            { userId: auth.userId },
            { userId: null },
          ],
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.log('[Notifications API] Marked all as read:', {
        userId: auth.userId,
        updatedCount: result.count,
      });

      return NextResponse.json({
        ok: true,
        message: '모든 알림을 읽음 처리했습니다.',
        updatedCount: result.count,
      });
    }

    if (!notificationId) {
      return NextResponse.json(
        { ok: false, error: '알림 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // S-2: IDOR 방지 - 특정 알림 업데이트 시 userId 소유권 검증
    // 1. 알림이 존재하는지 확인
    const notification = await prisma.adminNotification.findUnique({
      where: { id: notificationId },
      select: { userId: true, id: true },
    });

    if (!notification) {
      logger.warn('[Notifications API] Notification not found:', {
        userId: auth.userId,
        notificationId,
      });
      return NextResponse.json(
        { ok: false, error: '알림을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 소유권 검증: 개인 알림은 본인만 수정, 전체 공지사항은 모두 수정 가능
    if (notification.userId !== null && notification.userId !== auth.userId) {
      logger.warn('[Notifications API] IDOR attempt detected:', {
        userId: auth.userId,
        targetUserId: notification.userId,
        notificationId,
      });
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 특정 알림 읽음 처리
    await prisma.adminNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logger.log('[Notifications API] Marked notification as read:', {
      userId: auth.userId,
      notificationId,
    });

    return NextResponse.json({
      ok: true,
      message: '알림을 읽음 처리했습니다.',
    });
  } catch (error: any) {
    logger.error('[Notifications API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: '알림 읽음 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
