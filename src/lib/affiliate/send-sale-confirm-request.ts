/**
 * CRM → 크루즈닷: 판매확인 승인요청 (purchase.confirm_requested)
 *
 * 기존 purchase-confirm URL 재사용, eventType만 구분:
 *   'purchase.confirmed'        → 즉시 확정 (confirm-owner 기존 플로우)
 *   'purchase.confirm_requested' → 검토 요청 (APIS 보드 신규 플로우)
 *
 * 실패 시 throw → 호출부에서 finalConfirmStatus 변경 롤백
 */

import { logger } from '@/lib/logger';

export interface SaleConfirmRequestPayload {
  eventId: string;
  eventType: 'purchase.confirm_requested';
  saleId: number;           // GmAffiliateSale.id (Int, 공유 DB)
  reservationId: number;    // GmReservation.id (APIS 검토용)
  affiliateCode: string;
  requestedBy?: number;     // CRM 요청자 GmUser.id
  timestamp: string;
}

const DEFAULT_URL = 'https://www.cruisedot.co.kr/api/webhooks/purchase-confirm';

export async function sendSaleConfirmRequest(payload: SaleConfirmRequestPayload): Promise<void> {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CRUISEDOT_WEBHOOK_SECRET_MISSING');
  }
  const url = process.env.CRUISEDOT_PURCHASE_CONFIRM_URL ?? DEFAULT_URL;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.error('[sale-confirm-request] 네트워크/타임아웃', {
      saleId: payload.saleId,
      reservationId: payload.reservationId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err instanceof Error ? err : new Error(String(err));
  }

  // 409: 이미 요청 등록됨 → 멱등 성공
  if (res.status === 409) {
    logger.info('[sale-confirm-request] 409 멱등 성공', { saleId: payload.saleId });
    return;
  }
  if (res.ok) {
    logger.info('[sale-confirm-request] 전송 완료', {
      saleId: payload.saleId,
      reservationId: payload.reservationId,
    });
    return;
  }

  logger.error('[sale-confirm-request] 실패 응답', {
    saleId: payload.saleId,
    status: res.status,
  });
  throw new Error(`SALE_CONFIRM_REQUEST_FAILED_${res.status}`);
}
