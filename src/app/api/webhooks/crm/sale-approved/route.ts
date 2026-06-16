/**
 * POST /api/webhooks/crm/sale-approved
 * 크루즈닷 관리자 승인/거부 결과 수신
 *
 * 인증 2단계:
 *   1) Authorization: Bearer MABIZ_SALE_APPROVED_WEBHOOK_SECRET
 *   2) X-Signature: HMAC-SHA256(rawBody, secret) — hex 인코딩
 *
 * 페이로드: { eventId, saleId, reservationId, status: "APPROVED"|"REJECTED",
 *             rejectionReason?, timestamp }
 *
 * APPROVED → GmReservation finalConfirmStatus=APPROVED + CrmAffiliateSale status=APPROVED
 * REJECTED → GmReservation finalConfirmStatus=REJECTED + rejectionReason 저장
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface SaleApprovedPayload {
  eventId: string;
  saleId: number;
  reservationId: number;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_SALE_APPROVED_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[sale-approved] MABIZ_SALE_APPROVED_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 1. 원시 바디 읽기 (HMAC 검증을 위해 JSON 파싱 전에 읽어야 함)
  const rawBody = await req.text();

  // 2. Bearer 인증
  const rawAuth = req.headers.get('authorization') ?? '';
  const token = rawAuth.startsWith('Bearer ') ? rawAuth.slice(7) : '';
  if (
    token.length === 0 ||
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.warn('[sale-approved] Bearer 인증 실패');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 3. HMAC-SHA256 서명 검증
  const receivedSig = req.headers.get('x-signature') ?? '';
  if (receivedSig) {
    const expectedSig = createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBufExpected = Buffer.from(expectedSig, 'utf8');
    const sigBufReceived = Buffer.from(receivedSig, 'utf8');
    const sigMatch =
      sigBufExpected.length === sigBufReceived.length &&
      timingSafeEqual(sigBufExpected, sigBufReceived);
    if (!sigMatch) {
      logger.warn('[sale-approved] HMAC 서명 불일치');
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  // X-Signature 헤더가 없는 경우: Bearer만으로 통과 (하위 호환)

  let payload: SaleApprovedPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { eventId, saleId, reservationId, status, rejectionReason, timestamp } = payload;

  if (!eventId || !reservationId || !status || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ ok: false, message: '필수 필드 누락' }, { status: 400 });
  }

  logger.log('[sale-approved] 수신', { eventId, saleId, reservationId, status });

  // 멱등성 체크
  const already = await prisma.processedWebhookEvent.findUnique({
    where: { eventId_webhookType: { eventId, webhookType: 'crm-sale-approved' } },
  });
  if (already) {
    logger.log('[sale-approved] 중복 이벤트 무시', { eventId });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. GmReservation finalConfirmStatus 업데이트
      if (status === 'APPROVED') {
        await tx.$executeRaw`
          UPDATE "Reservation"
          SET "finalConfirmStatus"      = 'APPROVED',
              "finalConfirmApprovedAt"  = ${new Date(timestamp)}
          WHERE id = ${reservationId}
        `;
      } else {
        await tx.$executeRaw`
          UPDATE "Reservation"
          SET "finalConfirmStatus"          = 'REJECTED',
              "finalConfirmRejectedAt"      = ${new Date(timestamp)},
              "finalConfirmRejectionReason" = ${rejectionReason ?? null}
          WHERE id = ${reservationId}
        `;
      }

      // 2. CrmAffiliateSale 업데이트 (orderId = String(reservationId) 로 연결)
      if (status === 'APPROVED') {
        await tx.affiliateSale.updateMany({
          where: {
            orderId: String(reservationId),
            status: { notIn: ['REFUNDED', 'CANCELLED'] },
          },
          data: {
            status: 'APPROVED',
            updatedAt: new Date(),
          },
        });
      }

      // 3. 멱등 키 기록
      await tx.processedWebhookEvent.create({
        data: { eventId, webhookType: 'crm-sale-approved', status: 'SUCCESS' },
      });
    });

    logger.log('[sale-approved] 처리 완료', { eventId, reservationId, status });
    return NextResponse.json({ ok: true, reservationId, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('P2002')) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    logger.error('[sale-approved] 처리 실패', { eventId, err: message });
    await prisma.processedWebhookEvent
      .create({ data: { eventId, webhookType: 'crm-sale-approved', status: 'FAILED', errorMessage: message } })
      .catch((recordErr) => logger.error('[sale-approved] FAILED 기록 실패', {
        eventId,
        error: recordErr instanceof Error ? recordErr.message : String(recordErr),
      }));
    return NextResponse.json({ ok: false, message: '처리 실패' }, { status: 500 });
  }
}
