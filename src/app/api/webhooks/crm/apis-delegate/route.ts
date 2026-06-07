/**
 * POST /api/webhooks/crm/apis-delegate
 * 크루즈닷 → CRM: APIS 발송 위임
 *
 * 인증: Authorization: Bearer INTERNAL_WEBHOOK_SECRET
 *
 * 페이로드:
 *   PASSPORT: { batchId: string, targetType: "PASSPORT", userIds: number[] }
 *   PNR:      { batchId: string, targetType: "PNR",     reservationIds: number[] }
 *
 * 응답: { ok: true, queued: number }
 *
 * 완료 에코: passport-sent | pnr-sent — batchId 기준 배치 전체 완료 시 cron이 알림
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PassportPayload = {
  batchId: string;
  targetType: 'PASSPORT';
  userIds: number[];
};

type PnrPayload = {
  batchId: string;
  targetType: 'PNR';
  reservationIds: number[];
};

type DelegatePayload = PassportPayload | PnrPayload;

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[ApisDelegate] INTERNAL_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rawToken = req.headers.get('authorization') ?? '';
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

  if (
    token.length === 0 ||
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.warn('[ApisDelegate] 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: DelegatePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { batchId, targetType } = body;

  if (!batchId || !targetType) {
    return NextResponse.json({ ok: false, message: 'batchId, targetType 필수' }, { status: 400 });
  }

  logger.log('[ApisDelegate] 위임 수신', { batchId, targetType });

  if (targetType === 'PASSPORT') {
    const { userIds } = body as PassportPayload;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ ok: false, message: 'PASSPORT: userIds[]  필수' }, { status: 400 });
    }

    let queued = 0;
    for (const userId of userIds) {
      const existing = await prisma.gmApisSyncQueue.findFirst({
        where: { targetType: 'MASTER_SHEET', targetId: userId, status: { in: ['PENDING', 'PROCESSING'] } },
      });
      if (!existing) {
        await prisma.gmApisSyncQueue.create({
          data: { targetType: 'MASTER_SHEET', targetId: userId, batchId, status: 'PENDING' },
        });
        queued++;
      }
    }

    logger.log('[ApisDelegate] PASSPORT 큐 등록', { batchId, total: userIds.length, queued });
    return NextResponse.json({ ok: true, queued });
  }

  if (targetType === 'PNR') {
    const { reservationIds } = body as PnrPayload;
    if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
      return NextResponse.json({ ok: false, message: 'PNR: reservationIds[] 필수' }, { status: 400 });
    }

    let queued = 0;
    for (const reservationId of reservationIds) {
      const existing = await prisma.gmApisSyncQueue.findFirst({
        where: { targetType: 'PNR', targetId: reservationId, status: { in: ['PENDING', 'PROCESSING'] } },
      });
      if (!existing) {
        await prisma.gmApisSyncQueue.create({
          data: { targetType: 'PNR', targetId: reservationId, batchId, status: 'PENDING' },
        });
        queued++;
      }
    }

    logger.log('[ApisDelegate] PNR 큐 등록', { batchId, total: reservationIds.length, queued });
    return NextResponse.json({ ok: true, queued });
  }

  return NextResponse.json({ ok: false, message: `지원하지 않는 targetType: ${targetType}` }, { status: 400 });
}
