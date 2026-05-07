import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/push/settings
 * 사용자의 푸시 알림 설정 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const settings = await prisma.userPushSettings.findUnique({
      where: { userId: ctx.userId },
    });

    // 설정이 없으면 기본값 반환
    if (!settings) {
      return NextResponse.json({
        ok: true,
        settings: {
          userId: ctx.userId,
          notifyEnabled: true,
          notifyAtHour: 9,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        userId: settings.userId,
        notifyEnabled: settings.notifyEnabled,
        notifyAtHour: settings.notifyAtHour,
      },
    });
  } catch (err) {
    logger.error('[GET /api/push/settings]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

/**
 * PUT /api/push/settings
 * 사용자의 푸시 알림 설정 업데이트
 *
 * Body: {
 *   notifyEnabled?: boolean,
 *   notifyAtHour?: number (0-23)
 * }
 */
export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json();
    const { notifyEnabled, notifyAtHour } = body;

    // 검증
    if (notifyAtHour !== undefined) {
      const hour = parseInt(String(notifyAtHour));
      if (isNaN(hour) || hour < 0 || hour > 23) {
        return NextResponse.json({ ok: false, error: '시간은 0-23 범위여야 합니다' }, { status: 400 });
      }
    }

    const settings = await prisma.userPushSettings.upsert({
      where: { userId: ctx.userId },
      create: {
        userId: ctx.userId,
        notifyEnabled: notifyEnabled !== undefined ? notifyEnabled : true,
        notifyAtHour: notifyAtHour !== undefined ? notifyAtHour : 9,
      },
      update: {
        ...(notifyEnabled !== undefined && { notifyEnabled }),
        ...(notifyAtHour !== undefined && { notifyAtHour }),
      },
    });

    logger.log('[PUT /api/push/settings]', { userId: ctx.userId, notifyEnabled, notifyAtHour });

    return NextResponse.json({
      ok: true,
      settings: {
        userId: settings.userId,
        notifyEnabled: settings.notifyEnabled,
        notifyAtHour: settings.notifyAtHour,
      },
    });
  } catch (err) {
    logger.error('[PUT /api/push/settings]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
