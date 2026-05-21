export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { getPendingDLQEntries, resolveDLQ, failDLQ } from '@/lib/mabiz-dlq';

/**
 * GET /api/cron/retry-mabiz-dlq
 * Vercel Cron (매 5분) — DLQ 재시도
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      logger.warn('[CronDLQ] CRON_SECRET 미설정');
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    // [보안] Vercel Cron 인증
    // Vercel은 authorization: Bearer <CRON_SECRET> 형식으로 요청
    // 참고: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
    // P0-8: timingSafeEqual로 타이밍 공격 방지
    // P1-9: Vercel 문서와 일치 확인 완료 (2026-02-27)
    const expectedSecret = Buffer.from(`Bearer ${secret}`);
    const providedSecret = Buffer.from(auth);

    if (
      expectedSecret.length !== providedSecret.length ||
      !timingSafeEqual(expectedSecret, providedSecret)
    ) {
      logger.warn('[CronDLQ] Cron 인증 실패');
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const entries = await getPendingDLQEntries();
  if (entries.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  logger.log('[CronDLQ] 재시도 시작', { count: entries.length });

  let resolved = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

      const webhookUrl = `${baseUrl}/api/webhooks/${entry.webhookType}`;
      const webhookSecret = getWebhookSecret(entry.webhookType);

      if (!webhookSecret) {
        await failDLQ(entry.id, entry.retryCount, `시크릿 미설정: ${entry.webhookType}`);
        failed++;
        continue;
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`,
        },
        body: JSON.stringify(entry.payload),
      });

      if (res.ok) {
        await resolveDLQ(entry.id);
        resolved++;
      } else {
        const text = await res.text().catch(() => 'unknown');
        await failDLQ(entry.id, entry.retryCount, `HTTP ${res.status}: ${text.slice(0, 200)}`);
        failed++;
      }
    } catch (err) {
      await failDLQ(entry.id, entry.retryCount, String(err));
      failed++;
    }
  }

  logger.log('[CronDLQ] 완료', { resolved, failed, total: entries.length });
  return NextResponse.json({ ok: true, processed: entries.length, resolved, failed });
}

function getWebhookSecret(webhookType: string): string | undefined {
  const map: Record<string, string | undefined> = {
    'purchase': process.env.MABIZ_PURCHASE_WEBHOOK_SECRET,
    'refund': process.env.MABIZ_REFUND_WEBHOOK_SECRET,
    'inquiry': process.env.MABIZ_INQUIRY_WEBHOOK_SECRET,
    'gold-inquiry': process.env.MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET,
    'partner-signup': process.env.MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET,
    'cruise-purchase': process.env.MABIZ_PURCHASE_WEBHOOK_SECRET,
    'payapp': process.env.MABIZ_PAYAPP_WEBHOOK_SECRET,
  };
  return map[webhookType];
}
