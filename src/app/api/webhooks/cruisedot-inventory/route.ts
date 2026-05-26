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

    // 트랜잭션 처리
    await prisma.$transaction(async (tx) => {
      // 1. 제품 정보 조회 (organizationId로 테넌트 격리)
      const product = await tx.crmProduct.findFirst({
        where: {
          organizationId,
          code: productCode,
        },
        select: { id: true, name: true, currentStock: true },
      });

      if (!product) {
        logger.warn('[InventorySyncWebhook] 제품 미발견', { productCode, organizationId });
        throw new Error(`Product not found: ${productCode}`);
      }

      // 2. 재고 업데이트
      const newStock = action === 'decrement'
        ? Math.max(0, product.currentStock - quantity)
        : product.currentStock + quantity;

      if (action === 'decrement' && product.currentStock < quantity) {
        logger.warn('[InventorySyncWebhook] 재고 부족', {
          productCode,
          current: product.currentStock,
          requested: quantity,
        });
      }

      await tx.crmProduct.update({
        where: { id: product.id },
        data: {
          currentStock: newStock,
          lastInventorySyncAt: new Date(),
        },
      });

      // 3. Contact에 메모 기록 (추적용)
      if (contactId) {
        const contact = await tx.contact.findUnique({
          where: { id: contactId },
          select: { id: true, organizationId: true },
        });

        if (contact?.organizationId === organizationId) {
          await tx.contactMemo.create({
            data: {
              contactId,
              userId: 'system-webhook-inventory',
              content: `[재고동기] ${product.name} ${action === 'decrement' ? '-' : '+'}${quantity}개 (${newStock}개 남음)`,
            },
          });
        }
      }

      // 4. ProcessedWebhookEvent 기록 (멱등성)
      await tx.processedWebhookEvent.create({
        data: {
          eventId,
          webhookType: 'cruisedot-inventory',
          status: 'SUCCESS',
        },
      });
    });

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
