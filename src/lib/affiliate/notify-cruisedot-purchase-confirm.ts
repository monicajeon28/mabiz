/**
 * CRM → 크루즈닷몰 발신: 대리점장 구매확인(수당귀속 확정) 웹훅.
 *
 * ⚠️ 기존 notify-cruisedot.ts(HMAC X-Signature)와 인증 방식이 다르다 — 이 스펙은 Authorization: Bearer.
 *    잘못 복사하면 몰 401로 귀속이 영구 실패하므로 별도 파일/별도 함수로 둔다.
 *
 * 돈 발신 원칙:
 *  - res.ok 만 신뢰(응답 바디 의존 금지).
 *  - 몰 409(이미 확정) = 멱등 성공으로 간주(에러 아님).
 *  - secret 미설정/401/5xx/timeout = throw → 호출부가 confirmed 커밋을 하지 않고 DLQ로 보냄.
 *    (조용한 스킵 절대 금지)
 */
import { logger } from '@/lib/logger';

export interface PurchaseConfirmedPayload {
  /** 멱등 키 — 재시도 시 같은 값을 재사용해야 몰이 중복처리하지 않음 */
  eventId: string;
  eventType: 'purchase.confirmed';
  /** 몰 미러 AffiliateSale.id (Int) — cuid CrmAffiliateSale.id 금지 */
  saleId: number;
  ownerType: 'PRESALES' | 'BRANCH_MANAGER';
  /** 확정자 (User.id) — 감사용, 선택 */
  confirmedBy?: number;
  /** ISO8601 */
  timestamp: string;
}

export interface PurchaseConfirmResult {
  ok: boolean;
  status: number;
}

const DEFAULT_URL = 'https://www.cruisedot.co.kr/api/webhooks/purchase-confirm';

/**
 * 구매확인 웹훅을 몰로 발신한다.
 * @throws Error secret 미설정 / 401 / 5xx / timeout / 네트워크 오류 (호출부가 confirmed 미커밋 + DLQ 처리)
 */
export async function sendPurchaseConfirm(payload: PurchaseConfirmedPayload): Promise<PurchaseConfirmResult> {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  if (!secret) {
    // 돈 발신 — 조용한 스킵 금지. 확정 자체를 막는다.
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
      redirect: 'error', // 301(www↔non-www) 시 POST→GET 강등으로 body·인증 유실 차단
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.error('[purchase-confirm 발신] 네트워크/타임아웃', {
      saleId: payload.saleId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err instanceof Error ? err : new Error(String(err));
  }

  // 409: 몰이 이미 확정 처리 → 멱등 성공으로 간주
  if (res.status === 409) {
    logger.info('[purchase-confirm 발신] 409 멱등 성공', { saleId: payload.saleId });
    return { ok: true, status: 409 };
  }
  if (res.ok) {
    return { ok: true, status: res.status };
  }
  // 401(인증실패)·4xx·5xx → throw (confirmed 미커밋 + DLQ)
  logger.error('[purchase-confirm 발신] 실패 응답', { saleId: payload.saleId, status: res.status });
  throw new Error(`PURCHASE_CONFIRM_SEND_FAILED_${res.status}`);
}
