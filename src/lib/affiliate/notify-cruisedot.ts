/**
 * CRM 계약 승인 완료 → 크루즈닷몰 웹훅 발송
 * POST https://cruisedot.co.kr/api/webhooks/crm/affiliate-created
 *
 * 서명: HMAC-SHA256 (CRUISEDOT_WEBHOOK_SECRET)
 * 실패 시 계약 승인은 유지 — 로그만 남김 (fire-and-forget)
 */

import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

export interface AffiliateCreatedPayload {
  event: 'contract.approved';
  contractId: number;
  contractRef?: string;
  contractorName: string;
  approvedAt: string;
  // 계약당 1계정 모델: 등급에 맞는 슬롯 1개만 전송(나머지 생략). 구 3계정 호환 위해 선택적.
  manager?: {
    partnerId: string;
    role: 'affiliate_manager';
    affiliateCode: string;
    linkCode: string;
    linkUrl: string;
  };
  agent?: {
    partnerId: string;
    role: 'affiliate_agent';
    affiliateCode: string;
    linkCode: string;
    linkUrl: string;
  };
  presales?: {
    partnerId: string;
    role: 'affiliate_presales';
    affiliateCode: string;
    linkCode: string;
    linkUrl: string;
  };
}

export async function notifyCruisedotAffiliateCreated(
  payload: AffiliateCreatedPayload,
): Promise<void> {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  const webhookUrl = 'https://cruisedot.co.kr/api/webhooks/crm/affiliate-created';

  if (!secret) {
    logger.warn('[CRUISEDOT-NOTIFY] CRUISEDOT_WEBHOOK_SECRET 미설정 — 웹훅 발송 스킵');
    return;
  }

  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = `sha256=${createHmac('sha256', secret)
    .update(Buffer.from(body))
    .digest('hex')}`;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10초 타임아웃
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('[CRUISEDOT-NOTIFY] 웹훅 발송 실패 — 비정상 응답', {
        contractId: payload.contractId,
        status: res.status,
        body: text.slice(0, 200),
      });
    } else {
      logger.info('[CRUISEDOT-NOTIFY] ✅ 웹훅 발송 성공', {
        contractId: payload.contractId,
        linkCode: payload.manager?.linkCode ?? payload.agent?.linkCode ?? payload.presales?.linkCode,
      });
    }
  } catch (err) {
    logger.warn('[CRUISEDOT-NOTIFY] 웹훅 발송 네트워크 오류 — 계약 승인은 유지됨', {
      contractId: payload.contractId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
