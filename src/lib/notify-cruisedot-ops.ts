/**
 * CRM → 크루즈닷 운영 웹훅 알림
 *
 * 인증: x-signature: HMAC-SHA256(raw body, INTERNAL_WEBHOOK_SECRET) — raw hex, prefix 없음
 * 대상: https://www.cruisedot.co.kr/api/webhooks/crm/*
 *
 * ⚠️ 호출 전제: batchId 핸드오프 필요 (크루즈닷이 passport/PNR 요청 생성 시 발급한 UUID)
 * GmApisSyncQueue에 batchId 컬럼 없음 → 핸드오프 방식 협의 후 연결 예정
 *
 * 실패 시 메인 플로우 차단 없음 (fire-and-forget)
 */

import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

const CRUISEDOT_BASE = 'https://www.cruisedot.co.kr';

function sign(rawBody: string, secret: string): string {
  // raw hex — prefix 없음
  return createHmac('sha256', secret).update(Buffer.from(rawBody)).digest('hex');
}

interface OpsWebhookPayload {
  batchId: string;
  sentCount: number;
  failureCount?: number;
  timestamp?: string;
}

async function postToCruisedot(path: string, payload: OpsWebhookPayload): Promise<void> {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn(`[CruisedotOps] INTERNAL_WEBHOOK_SECRET 미설정 — ${path} 스킵`);
    return;
  }
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(`${CRUISEDOT_BASE}/api/webhooks/crm/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': sign(body, secret),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn(`[CruisedotOps] ${path} 발송 실패`, { status: res.status, batchId: payload.batchId });
    } else {
      logger.info(`[CruisedotOps] ${path} ✅`, { batchId: payload.batchId, sentCount: payload.sentCount });
    }
  } catch (err) {
    logger.warn(`[CruisedotOps] ${path} 네트워크 오류 — 무시됨`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * APIS 여권 데이터 전송 완료 → cruisedot passport-sent 알림
 * @param batchId 크루즈닷이 발급한 SmsQueue 배치 UUID
 * @param sentCount 발송 성공 건수
 * @param failureCount 발송 실패 건수 (선택)
 */
export async function notifyCruisedotPassportSent(
  batchId: string,
  sentCount: number,
  failureCount?: number,
): Promise<void> {
  await postToCruisedot('passport-sent', {
    batchId,
    sentCount,
    failureCount,
    timestamp: new Date().toISOString(),
  });
}

/**
 * PNR SMS 발송 완료 → cruisedot pnr-sent 알림
 * @param batchId 크루즈닷이 발급한 SmsQueue 배치 UUID
 * @param sentCount 발송 성공 건수
 * @param failureCount 발송 실패 건수 (선택)
 */
export async function notifyCruisedotPnrSent(
  batchId: string,
  sentCount: number,
  failureCount?: number,
): Promise<void> {
  await postToCruisedot('pnr-sent', {
    batchId,
    sentCount,
    failureCount,
    timestamp: new Date().toISOString(),
  });
}
