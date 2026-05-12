import { logger } from '@/lib/logger';

interface MabizPurchasePayload {
  organizationId: string;
  phone: string;
  name: string;
  productName?: string;
  departureDate?: Date | null;
  orderId?: string;
  affiliateCode?: string;
  cabinType?: string | null;
}

/**
 * 크루즈몰 결제 완료 후 mabiz CRM에 고객 정보 전송
 * fire-and-forget: 실패해도 결제 처리에 영향 없음
 */
export async function syncPurchaseToMabiz(payload: MabizPurchasePayload): Promise<void> {
  const webhookUrl = process.env.MABIZ_PURCHASE_WEBHOOK_URL;
  const webhookSecret = process.env.MABIZ_PURCHASE_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    logger.error('[MabizSync] 환경변수 미설정 — 구매자 CRM 미등록', { webhookUrl: !!webhookUrl, webhookSecret: !!webhookSecret });
    return;
  }

  // SSRF 방지: 허용된 도메인만
  const allowedHosts = ['mabizcruisedot.com', 'mabiz.vercel.app', 'localhost'];
  try {
    const url = new URL(webhookUrl);
    const isAllowed = allowedHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
    if (!isAllowed) {
      logger.error('[MabizSync] 허용되지 않은 도메인', { hostname: url.hostname });
      return;
    }
  } catch {
    logger.error('[MabizSync] 잘못된 MABIZ_PURCHASE_WEBHOOK_URL');
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({
        ...payload,
        departureDate: payload.departureDate?.toISOString() ?? null,
        affiliateCode: payload.affiliateCode ?? null,
        cabinType: payload.cabinType ?? null,
      }),
    });

    if (!res.ok) {
      logger.error('[MabizSync] 전송 실패', { status: res.status });
    } else {
      logger.debug('[MabizSync] 전송 완료', {
        phone: payload.phone.substring(0, 4) + '***',
        productName: payload.productName,
      });
    }
  } catch (err) {
    logger.error('[MabizSync] 네트워크 오류', { err });
  }
}

interface MabizNewsSyncPayload {
  action:    'create' | 'deactivate';
  shortCode: string;
  title?:    string;
  url?:      string;
}

export async function syncNewsToMabiz(payload: MabizNewsSyncPayload): Promise<void> {
  const webhookUrl = process.env.MABIZ_NEWS_WEBHOOK_URL;
  const secret     = process.env.MABIZ_NEWS_WEBHOOK_SECRET;
  if (!webhookUrl || !secret) {
    logger.debug('[MabizNewsSync] 환경변수 미설정 — 뉴스 동기화 건너뜀', { action: payload.action });
    return;
  }

  // SSRF 방지
  const allowedHosts = ['mabizcruisedot.com', 'mabiz.vercel.app', 'localhost'];
  try {
    const url = new URL(webhookUrl);
    const ok  = allowedHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
    if (!ok) { logger.error('[MabizNewsSync] 허용되지 않은 도메인', { hostname: url.hostname }); return; }
  } catch { logger.error('[MabizNewsSync] 잘못된 URL'); return; }

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) logger.error('[MabizNewsSync] 전송 실패', { status: res.status, action: payload.action });
    else logger.debug('[MabizNewsSync] 전송 완료', { action: payload.action, shortCode: payload.shortCode });
  } catch (e) {
    logger.error('[MabizNewsSync] 네트워크 오류', { error: e instanceof Error ? e.message : String(e) });
  }
}
