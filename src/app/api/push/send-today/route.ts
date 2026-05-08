import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import webpush from 'web-push';

// VAPID 설정 (환경변수 필수)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@mabiz.kr';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

/**
 * POST /api/push/send-today
 * 대시보드 "폰으로 보내기" 버튼
 * 현재 사용자의 오늘 콜 목록을 푸시로 즉시 발송
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    // organizationId 필수 (GLOBAL_ADMIN 제외)
    if (!ctx.organizationId && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'organizationId 필수' }, { status: 400 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { ok: false, error: '푸시 알림이 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    // 사용자의 푸시 구독 조회
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: ctx.userId },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ ok: false, error: '등록된 푸시 구독이 없습니다' }, { status: 400 });
    }

    // 오늘 콜 예정 건수 조회
    const callDueRows = await prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "CallLog"
      WHERE "userId" = ${ctx.userId}
        AND ("scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `
    );

    const callDueCount = Number(callDueRows[0]?.count ?? 0);

    if (callDueCount === 0) {
      return NextResponse.json(
        { ok: false, error: '오늘 예정된 콜이 없습니다' },
        { status: 400 }
      );
    }

    // 푸시 메시지 생성
    const pushPayload = {
      title: '📞 오늘 콜 예정',
      body: `${callDueCount}명의 고객과 콜이 예정되어 있습니다`,
      icon: '/icon-192.png',
      data: {
        url: '/dashboard',
      },
    };

    // 모든 구독자에게 푸시 발송 (fire-and-forget)
    const sendPromises = subscriptions.map(sub =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(pushPayload)
        )
        .catch(err => {
          // 푸시 발송 실패 시 구독 정보 삭제 (사용자가 알림을 비활성화한 경우 등)
          if (err.statusCode === 410 || err.statusCode === 404) {
            prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
          logger.error('[push-send-today] 푸시 발송 실패', { subscriptionId: sub.id, err: err.message });
        })
    );

    const results = await Promise.allSettled(sendPromises);

    // 발송 결과 집계
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    logger.log('[POST /api/push/send-today]', { userId: ctx.userId, callDueCount, sentTo: subscriptions.length, successCount, failureCount });

    // PushLog 저장 (fire-and-forget)
    (async () => {
      try {
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO "PushLog" ("organizationId", "subscriptionCount", "successCount", "failureCount", "createdAt")
          VALUES (${ctx.organizationId}, ${subscriptions.length}, ${successCount}, ${failureCount}, NOW())
        `);
      } catch (err) {
        logger.error('[push/send-today] PushLog 저장 실패', { err });
      }
    })();

    return NextResponse.json({
      ok: true,
      callDueCount,
      sentTo: subscriptions.length,
      successCount,
      failureCount,
    });
  } catch (err) {
    logger.error('[POST /api/push/send-today]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
