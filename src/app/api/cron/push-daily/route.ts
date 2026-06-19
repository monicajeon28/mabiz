export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import webpush from 'web-push';

/**
 * GET /api/cron/push-daily
 * 매시간 0분에 실행 (Vercel Crons)
 * 오늘 콜이 예정된 사용자 중 설정한 시간에 해당하는 사용자에게 푸시 발송
 *
 * 동작:
 * 1. 현재 시간(KST)의 notifyAtHour를 가진 사용자 조회
 * 2. 해당 사용자들의 오늘 콜 예정 건수 집계
 * 3. 콜이 있는 사용자에게만 푸시 발송
 * 4. 발송 후 lastPushedAt 업데이트 (오늘 이미 보낸 경우 중복 방지)
 */
export async function GET(req: Request) {
  // VAPID 설정 (함수 내부로 이동)
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@mabiz.kr';
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  }

  try {
    // Vercel Crons 인증 (요청 헤더에 Authorization 포함)
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.warn('[cron/push-daily] VAPID 키가 설정되지 않았습니다');
      return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
    }

    // 현재 시간 (Asia/Seoul)
    const now = new Date();
    const kstHours = Math.floor((now.getTime() + 9 * 60 * 60 * 1000) / (60 * 60 * 1000)) % 24;
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).toISOString().split('T')[0];

    logger.log('[cron/push-daily] 실행 중', { kstHours, today });

    // 현재 시간에 푸시를 받도록 설정한 사용자 조회 (알림 활성화됨)
    const usersToNotify = await prisma.userPushSettings.findMany({
      where: {
        notifyEnabled: true,
        notifyAtHour: kstHours,
      },
      select: { userId: true },
    });

    if (usersToNotify.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
    }

    let sentCount = 0;
    let skippedCount = 0;

    // 각 사용자별로 오늘 콜 예정 조회 및 푸시 발송
    for (const user of usersToNotify) {
      try {
        // 오늘 콜 예정 건수 조회
        const callDueRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM "CallLog"
          WHERE "userId" = ${user.userId}
            AND ("scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
        `);

        const callDueCount = Number(callDueRows[0]?.count ?? 0);

        if (callDueCount === 0) {
          skippedCount++;
          continue;
        }

        // 사용자의 푸시 구독 조회
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: user.userId },
        });

        if (subscriptions.length === 0) {
          skippedCount++;
          continue;
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
              // 푸시 발송 실패 시 구독 정보 삭제
              if (err.statusCode === 410 || err.statusCode === 404) {
                prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
              }
            })
        );

        await Promise.allSettled(sendPromises);

        // lastPushedAt 업데이트 (오늘 이미 보낸 것으로 표시)
        await prisma.userPushSettings.update({
          where: { userId: user.userId },
          data: { lastPushedAt: new Date() },
        });

        sentCount++;
        logger.log('[cron/push-daily] 푸시 발송 완료', {
          userId: user.userId,
          callDueCount,
          sentTo: subscriptions.length,
        });
      } catch (err) {
        logger.error('[cron/push-daily] 사용자 푸시 발송 실패', { userId: user.userId, err });
      }
    }

    logger.log('[cron/push-daily] 완료', { sentCount, skippedCount });

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      skipped: skippedCount,
      totalUsers: usersToNotify.length,
    });
  } catch (err) {
    logger.error('[cron/push-daily]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
