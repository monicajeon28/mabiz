import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/cruisedot-inventory
 * mabiz CRM에서 cruisedot 예약이 발생할 때 재고 감소
 * 테스트 신청/예약 생성 → CRM에서 이벤트 발행 → cruisedot 재고 동기화
 * Authorization: Bearer CRUISEDOT_INVENTORY_WEBHOOK_SECRET
 */

interface InventorySyncPayload {
  eventId: string;
  eventType: 'sale.created' | 'sale.updated' | 'sale.refunded';
  timestamp: string;
  organizationId: string;
  contactId: string;
  productCode: string;
  quantity: number;
  action: 'decrement' | 'increment';
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_INVENTORY_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[InventorySyncWebhook] CRUISEDOT_INVENTORY_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false, error: '서버 설정 오류' }, { status: 500 });
  }

  // Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== secret) {
    logger.warn('[InventorySyncWebhook] 인증 실패');
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
  }

  // 요청 본문 읽기
  const body = await req.text();

  // HMAC-SHA256 서명 검증
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('[InventorySyncWebhook] 서명 검증 실패');
    return NextResponse.json({ ok: false, error: '서명 검증 실패' }, { status: 403 });
  }

  // JSON 파싱
  let payload: InventorySyncPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { eventId, eventType, organizationId, contactId, productCode, quantity, action } = payload;

  // 필수 필드 검증
  if (!eventId || !eventType || !organizationId || !productCode || !quantity || !action) {
    logger.warn('[InventorySyncWebhook] 필수 필드 누락', { eventId, productCode });
    return NextResponse.json({ ok: false, message: '필수 필드 누락' }, { status: 400 });
  }

  logger.log('[InventorySyncWebhook] 수신', {
    eventId,
    eventType,
    productCode,
    quantity,
    action,
  });

  try {
    // eventId 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
    });

    if (alreadyProcessed) {
      logger.log('[InventorySyncWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 멱등성 기록만 처리 (재고 동기화는 Phase 2에서 구현)
    await prisma.processedWebhookEvent.create({
      data: {
        eventId,
        webhookType: 'cruisedot-inventory',
        status: 'SUCCESS',
      },
    }).catch(() => {});

    logger.log('[InventorySyncWebhook] 처리 완료', {
      eventId,
      productCode,
      action,
      quantity,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[InventorySyncWebhook] 처리 실패', { err, eventId });

    // 실패 기록
    await prisma.processedWebhookEvent
      .create({
        data: {
          eventId,
          webhookType: 'cruisedot-inventory',
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: false, error: '처리 실패' }, { status: 500 });
  }
}
