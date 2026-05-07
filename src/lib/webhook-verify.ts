/**
 * src/lib/webhook-verify.ts
 * HMAC-SHA256 웹훅 서명 검증 — GMcruise 계약서 서명 완료 웹훅 전용
 *
 * 서명 형식: X-Signature: sha256=<hex>
 * 서명 대상: raw request body (Buffer)
 * 알고리즘: HMAC-SHA256
 * 재전송 방지: X-Timestamp 헤더 ± 5분 이내만 수락
 *
 * GMcruise 측 서명 생성 예시 (Node.js):
 *   const sig = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
 *   headers['X-Signature'] = sig;
 *   headers['X-Timestamp'] = Date.now().toString();
 */

import { createHmac, timingSafeEqual } from 'crypto';

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5분

export interface VerifyWebhookResult {
  ok:      boolean;
  reason?: string;
}

/**
 * verifyGmcruiseWebhook
 *
 * @param rawBody       Buffer — request body (반드시 raw, JSON.parse 전)
 * @param signatureHdr  X-Signature 헤더값 ("sha256=<hex>")
 * @param timestampHdr  X-Timestamp 헤더값 (Unix ms 문자열)
 * @param secret        PARTNER_CONTRACT_WEBHOOK_SECRET 환경변수
 */
export function verifyGmcruiseWebhook(
  rawBody:      Buffer,
  signatureHdr: string | null,
  timestampHdr: string | null,
  secret:       string,
): VerifyWebhookResult {
  // 1) 재전송 공격 방지 — 타임스탬프 검증
  if (!timestampHdr) {
    return { ok: false, reason: 'X-Timestamp 헤더 없음' };
  }
  const ts = parseInt(timestampHdr, 10);
  if (isNaN(ts)) {
    return { ok: false, reason: 'X-Timestamp 형식 오류' };
  }
  const ageMs = Date.now() - ts;
  if (Math.abs(ageMs) > REPLAY_WINDOW_MS) {
    return { ok: false, reason: `타임스탬프 범위 초과 (${Math.round(ageMs / 1000)}s)` };
  }

  // 2) 서명 검증
  if (!signatureHdr || !signatureHdr.startsWith('sha256=')) {
    return { ok: false, reason: 'X-Signature 헤더 없음 또는 형식 오류' };
  }

  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual   = signatureHdr;

  // 길이가 다르면 timingSafeEqual이 throw — 먼저 길이 확인
  if (expected.length !== actual.length) {
    return { ok: false, reason: '서명 불일치' };
  }

  const match = timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  if (!match) {
    return { ok: false, reason: '서명 불일치' };
  }

  return { ok: true };
}
