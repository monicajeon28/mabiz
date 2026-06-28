import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { recordProcessedWebhookEvent } from '@/lib/webhook-execution';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/cruisedot-product
 * 크루즈닷몰 → CRM 상품 카탈로그/환불정책/객실마스터 동기화 웹훅
 * - 모든 eventType이 동일한 "전체 스냅샷"을 보냄 → eventType 분기 없이 productCode upsert(멱등)
 * - 실시간 재고(CabinInventory.bookedCount)는 절대 건드리지 않음(기존 cruisedot-inventory 웹훅이 단독 주인).
 *   객실 마스터는 CruiseProduct.roomInventory(Json)에 저장 + availableCount/reservedCount(합계)도 채워
 *   상품 화면의 "전체 잔여 N석/크루즈닷 자동" 배지가 자동 동작하게 함.
 * 인증: Bearer Token (HMAC 없음 — inventory 웹훅과 별도 시크릿 MABIZ_PRODUCT_WEBHOOK_SECRET)
 */

function normalizeCabinType(raw: string): string {
  const map: Record<string, string> = {
    '인사이드': 'inside',
    '오션뷰': 'oceanview',
    '발코니': 'balcony',
    '스위트': 'suite',
  };
  return map[raw] ?? raw.toLowerCase();
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const RoomInventoryItemSchema = z
  .object({
    roomType: z.string().min(1),
    totalRooms: z.number().int().min(0),
    soldRooms: z.number().int().min(0),
    remaining: z.number().int(),
    organizationId: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    marketingLabel: z.string().nullable().optional(),
    maxOccupancy: z.number().int().nullable().optional(),
  })
  .passthrough();

const ProductWebhookSchema = z
  .object({
    eventId: z.string().min(1),
    eventType: z.string().min(1), // 정보용 — 처리 분기에 쓰지 않음(전 종류 동일 스냅샷)
    productCode: z.string().min(1),
    packageName: z.string().min(1),
    cruiseLine: z.string().min(1),
    shipName: z.string().min(1),
    nights: z.number().int().min(0),
    days: z.number().int().min(0),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    basePrice: z.number().int().nullable().optional(),
    salePrice: z.number().int().nullable().optional(),
    saleStatus: z.string().optional(),
    isGold: z.boolean().optional(),
    deleted: z.boolean().optional(),
    syncedAt: z.string().nullable().optional(),
    refundPolicy: z.any().optional(),
    roomInventory: z.array(RoomInventoryItemSchema).max(100).optional(), // 비현실적 대용량 페이로드(메모리/DB 비대) 차단
  })
  .passthrough();

type ProductWebhookPayload = z.infer<typeof ProductWebhookSchema>;

export async function POST(req: NextRequest) {
  const secret = process.env.MABIZ_PRODUCT_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[ProductSyncWebhook] MABIZ_PRODUCT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false, error: '서버 설정 오류' }, { status: 503 });
  }

  // Bearer Token 검증 (timingSafeEqual + 바이트길이 선검사)
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const tokenBuf = Buffer.from(token, 'utf8');
  const secretBuf = Buffer.from(secret, 'utf8');
  if (tokenBuf.byteLength !== secretBuf.byteLength || !timingSafeEqual(tokenBuf, secretBuf)) {
    logger.warn('[ProductSyncWebhook] 인증 실패');
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
  }

  const rawBody = await req.text();
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 파싱 실패' }, { status: 400 });
  }

  const parsed = ProductWebhookSchema.safeParse(rawJson);
  if (!parsed.success) {
    logger.warn('[ProductSyncWebhook] 스키마 검증 실패', { errors: parsed.error.flatten() });
    return NextResponse.json(
      { ok: false, error: '필수 필드 누락 또는 형식 오류', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload: ProductWebhookPayload = parsed.data;
  const { eventId, productCode } = payload;
  const isDeleted = payload.deleted === true;

  logger.log('[ProductSyncWebhook] 수신', {
    eventId, eventType: payload.eventType, productCode, deleted: isDeleted,
    rooms: payload.roomInventory?.length ?? 0,
  });

  try {
    // 멱등성 체크
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId_webhookType: { eventId, webhookType: 'cruisedot-product' } },
    });
    // SUCCESS만 "처리 완료"로 간주. FAILED 행은 재시도가 다시 처리하도록 통과(중독 방지 — 컬럼 미적용 등 일시오류 후 같은 eventId 재전송 복구).
    if (alreadyProcessed?.status === 'SUCCESS') {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 객실 마스터 정규화 (cabinType 키 수렴 — CabinInventory 읽기와 일관)
    const roomMaster = (payload.roomInventory ?? []).map((r) => ({
      cabinType: normalizeCabinType(r.roomType),
      totalRooms: r.totalRooms,
      soldRooms: r.soldRooms,
      remaining: Math.max(0, r.remaining), // 음수 잔여는 0으로 클램프(표시 "잔여 -5" 방지)
      organizationId: r.organizationId ?? null,
      label: r.label ?? null,
      marketingLabel: r.marketingLabel ?? null,
      maxOccupancy: r.maxOccupancy ?? null,
    }));

    // 잔여/판매 합계 → 상품 화면 "전체 잔여 N석/크루즈닷 자동" 배지용(표시·마케팅; 실시간 SSoT는 CabinInventory)
    const hasRooms = roomMaster.length > 0;
    const totalRemaining = hasRooms ? roomMaster.reduce((s, r) => s + Math.max(0, r.remaining), 0) : null;
    const totalSold = hasRooms ? roomMaster.reduce((s, r) => s + Math.max(0, r.soldRooms), 0) : null;

    const now = new Date();
    const common = {
      cruiseLine: payload.cruiseLine,
      shipName: payload.shipName,
      packageName: payload.packageName,
      nights: payload.nights,
      days: payload.days,
      startDate: toDate(payload.startDate),
      endDate: toDate(payload.endDate),
      basePrice: payload.basePrice ?? null,
      salePrice: payload.salePrice ?? null,
      isGold: payload.isGold ?? false,
      saleStatus: payload.saleStatus ?? '판매중',
      refundPolicy: payload.refundPolicy ?? undefined, // Json 원문 보존
      roomInventory: roomMaster,                         // Json 마스터. CabinInventory 미변경.
      availableCount: totalRemaining,                    // 표시용 잔여 합계
      reservedCount: totalSold,
      // soft delete 반영
      deletedAt: isDeleted ? now : null,
      deletedBy: isDeleted ? 'cruisedot-webhook' : null,
      isVisible: !isDeleted,
      isActive: !isDeleted,
      updatedAt: now, // @updatedAt 아님 → 항상 명시
    };

    await prisma.$transaction(
      async (tx) => {
        await tx.cruiseProduct.upsert({
          where: { productCode },
          update: { ...common }, // itineraryPattern 미터치(기존 일정 보존)
          create: { productCode, ...common, itineraryPattern: [] }, // non-null Json → create 기본값 필수
        });
        // FAILED 선행 행이 있으면 SUCCESS로 갱신(중독 방지). 없으면 생성.
        await tx.processedWebhookEvent.upsert({
          where: { eventId_webhookType: { eventId, webhookType: 'cruisedot-product' } },
          create: { eventId, webhookType: 'cruisedot-product', status: 'SUCCESS', errorMessage: null, processedAt: new Date() },
          update: { status: 'SUCCESS', errorMessage: null, processedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    logger.log('[ProductSyncWebhook] 처리 완료', { eventId, productCode, deleted: isDeleted });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[ProductSyncWebhook] 처리 실패', { error: err instanceof Error ? err.message : String(err), eventId });
    await recordProcessedWebhookEvent(prisma, {
      eventId,
      webhookType: 'cruisedot-product',
      status: 'FAILED',
      errorMessage: err instanceof Error ? err.message : String(err),
      context: '[ProductSyncWebhook] FAILED 기록 실패',
    });
    return NextResponse.json({ ok: false, error: '처리 실패' }, { status: 500 });
  }
}
