/**
 * CRM → 크루즈닷 운영 웹훅 알림
 *
 * 인증: x-signature: HMAC-SHA256(body, INTERNAL_WEBHOOK_SECRET)
 * 대상: https://cruisedot.com/api/webhooks/crm/*
 *
 * 실패 시 메인 플로우 차단 없음 (fire-and-forget)
 */

import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

const CRUISEDOT_BASE = 'https://cruisedot.com';

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

async function postToCruisedot(path: string, payload: object): Promise<void> {
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
      logger.warn(`[CruisedotOps] ${path} 발송 실패`, { status: res.status });
    } else {
      logger.info(`[CruisedotOps] ${path} ✅`, payload);
    }
  } catch (err) {
    logger.warn(`[CruisedotOps] ${path} 네트워크 오류 — 무시됨`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** APIS 여권 데이터 전송 완료 → cruisedot 알림 */
export async function notifyCruisedotPassportSent(tripId: number): Promise<void> {
  await postToCruisedot('passport-sent', {
    event: 'passport.sent',
    tripId,
    sentAt: new Date().toISOString(),
  });
}

/** PNR SMS 발송 완료 → cruisedot 알림 */
export async function notifyCruisedotPnrSent(reservationId: number): Promise<void> {
  await postToCruisedot('pnr-sent', {
    event: 'pnr.sent',
    reservationId,
    sentAt: new Date().toISOString(),
  });
}
