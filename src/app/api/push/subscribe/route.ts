import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * POST /api/push/subscribe
 * 브라우저의 푸시 구독 정보 저장 (upsert by endpoint)
 *
 * Body: {
 *   subscription: {
 *     endpoint: string,
 *     keys: { p256dh: string, auth: string }
 *   }
 * }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json();
    const { subscription } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: '구독 정보가 불완전합니다' }, { status: 400 });
    }

    // 브라우저가 제공한 구독 정보 저장/업데이트
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: ctx.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        role: ctx.role,
      },
      update: {
        // endpoint는 유일하므로 이미 존재하면 업데이트 (사용자가 변경되었을 수 있음)
        userId: ctx.userId,
        role: ctx.role,
      },
    });

    logger.log('[POST /api/push/subscribe]', { userId: ctx.userId, role: ctx.role });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /api/push/subscribe]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * 푸시 구독 해제
 *
 * Body: { endpoint: string }
 */
export async function DELETE(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ ok: false, error: 'endpoint 필수' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: ctx.userId },
    });

    logger.log('[DELETE /api/push/subscribe]', { userId: ctx.userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/push/subscribe]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
