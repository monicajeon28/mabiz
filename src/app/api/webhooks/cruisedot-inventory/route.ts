import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { recordProcessedWebhookEvent } from '@/lib/webhook-execution';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/cruisedot-inventory
 * 크루즈닷몰 → CRM 인벤토리 동기화 웹훅
 * eventType: inventory.decrement (판매) | inventory.increment (취소/환불)
 * 인증: Bearer Token + HMAC-SHA256
 */

// ─── 로컬 헬퍼 ───────────────────────────────────────────────────────────────

function normalizeCabinType(raw: string): string {
  const map: Record<string, string> = {
    '인사이드': 'inside',
    '오션뷰': 'oceanview',
    '발코니': 'balcony',
    '스위트': 'suite',
  };
  return map[raw] ?? raw.toLowerCase();
}

// ─── Zod 스키마 ───────────────────────────────────────────────────────────────

const InventorySnapshotSchema = z.record(
  z.string(),
  z.object({
    total:     z.number().int().min(0),
    booked:    z.number().int().min(0),
    remaining: z.number().int().min(0),
  })
);

const InventoryWebhookSchema = z.object({
  eventId:           z.string().min(1),
  eventType:         z.enum(['inventory.decrement', 'inventory.increment']),
  productCode:       z.string().min(1),
  cabinType:         z.string().min(1),
  quantity:          z.number().int().min(1),
  action:            z.enum(['decrement', 'increment']),
  organizationId:    z.string().min(1),
  inventorySnapshot: InventorySnapshotSchema.optional(),
});

type InventoryWebhookPayload = z.infer<typeof InventoryWebhookSchema>;

// ─── POST 핸들러 ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_INVENTORY_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[InventorySyncWebhook] CRUISEDOT_INVENTORY_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false, error: '서버 설정 오류' }, { status: 500 });
  }

  // Bearer Token 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  if (
    token.length !== secret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    logger.warn('[InventorySyncWebhook] 인증 실패');
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
  }

  // 요청 본문 읽기
  const body = await req.text();

  // HMAC-SHA256 서명 검증
  const signature = req.headers.get('x-signature') ?? '';
  const expectedSignature = createHmac('sha256', secret).update(body).digest('hex');

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    logger.warn('[InventorySyncWebhook] 서명 검증 실패');
    return NextResponse.json({ ok: false, error: '서명 검증 실패' }, { status: 403 });
  }

  // JSON 파싱 + Zod 검증
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 파싱 실패' }, { status: 400 });
  }

  const parsed = InventoryWebhookSchema.safeParse(rawJson);
  if (!parsed.success) {
    logger.warn('[InventorySyncWebhook] 스키마 검증 실패', { errors: parsed.error.flatten() });
    return NextResponse.json(
      { ok: false, error: '필수 필드 누락 또는 형식 오류', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload: InventoryWebhookPayload = parsed.data;
  const { eventId, productCode, action, quantity, organizationId, inventorySnapshot } = payload;

  logger.log('[InventorySyncWebhook] 수신', {
    eventId,
    eventType: payload.eventType,
    productCode,
    cabinType: payload.cabinType,
    quantity,
    action,
    hasSnapshot: !!inventorySnapshot,
  });

  try {
    // 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: {
        eventId_webhookType: {
          eventId,
          webhookType: 'cruisedot-inventory',
        },
      },
    });

    if (alreadyProcessed) {
      logger.log('[InventorySyncWebhook] 중복 이벤트 무시', { eventId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 재고 동기화 트랜잭션
    await prisma.$transaction(
      async (tx) => {
        if (inventorySnapshot) {
          // 스냅샷 기반: 모든 cabinType을 정확하게 덮어쓰기
          for (const [rawType, snap] of Object.entries(inventorySnapshot)) {
            const cabinType = normalizeCabinType(rawType);
            await tx.cabinInventory.upsert({
              where: {
                organizationId_tripCode_cabinType: {
                  organizationId,
                  tripCode: productCode,
                  cabinType,
                },
              },
              update: {
                bookedCount: snap.booked,
                totalCount:  snap.total,
                status:      snap.remaining <= 0 ? 'SOLD_OUT' : 'AVAILABLE',
                updatedAt:   new Date(),
              },
              create: {
                organizationId,
                tripCode:   productCode,
                tripName:   productCode,
                cabinType,
                totalCount: snap.total,
                bookedCount: snap.booked,
                status:     snap.remaining <= 0 ? 'SOLD_OUT' : 'AVAILABLE',
              },
            });
          }
        } else {
          // 증감 기반: 해당 cabinType만 업데이트
          const cabinType = normalizeCabinType(payload.cabinType);
          const existing = await tx.cabinInventory.findUnique({
            where: {
              organizationId_tripCode_cabinType: {
                organizationId,
                tripCode: productCode,
                cabinType,
              },
            },
          });

          if (existing) {
            const newBooked =
              action === 'decrement'
                ? Math.min(existing.bookedCount + quantity, existing.totalCount)
                : Math.max(existing.bookedCount - quantity, 0);

            await tx.cabinInventory.update({
              where: { id: existing.id },
              data: {
                bookedCount: newBooked,
                status:      newBooked >= existing.totalCount ? 'SOLD_OUT' : 'AVAILABLE',
                updatedAt:   new Date(),
              },
            });
          } else {
            logger.warn('[InventorySyncWebhook] CabinInventory 레코드 없음 — 증감 스킵', {
              organizationId,
              productCode,
              cabinType,
            });
          }
        }
      },
      { isolationLevel: 'Serializable' }
    );

    // 멱등성 기록
    await recordProcessedWebhookEvent(prisma, {
      eventId,
      webhookType: 'cruisedot-inventory',
      context: '[InventorySyncWebhook] SUCCESS 기록 실패',
    });

    logger.log('[InventorySyncWebhook] 처리 완료', { eventId, productCode, action, quantity });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[InventorySyncWebhook] 처리 실패', { err, eventId });

    await recordProcessedWebhookEvent(prisma, {
      eventId,
      webhookType: 'cruisedot-inventory',
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : String(err),
      context: '[InventorySyncWebhook] FAILED 기록 실패',
    });

    return NextResponse.json({ ok: false, error: '처리 실패' }, { status: 500 });
  }
}
