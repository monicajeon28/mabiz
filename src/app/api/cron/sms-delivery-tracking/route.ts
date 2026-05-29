export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { trackAllSmsDelivery } from "@/lib/aligo/delivery-tracker";
import { logger } from "@/lib/logger";
import { validateCronSecret } from "@/lib/cron-middleware";

/**
 * GET /api/cron/sms-delivery-tracking
 * Vercel Cron (매 시간) — SMS 배송 상태 추적 및 재시도
 * Authorization: Bearer CRON_SECRET
 *
 * 기능:
 * - SENT 상태 SMS의 배송 상태 확인
 * - 배송 완료 → DELIVERED로 업데이트
 * - 배송 실패 → 자동 재시도 (최대 3회)
 * - SmsLog 기록
 */
export async function GET(req: Request) {
  // Cron 인증 (통일된 미들웨어 사용)
  const authResult = validateCronSecret(req);
  if (!authResult.ok) {
    return authResult.response || NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    // 모든 조직의 배송 상태 추적
    const results = await trackAllSmsDelivery();

    const summary = {
      organizations: Object.keys(results).length,
      totalChecked: Object.values(results).reduce((sum, r) => sum + r.checked, 0),
      totalUpdated: Object.values(results).reduce((sum, r) => sum + r.updated, 0),
      totalRetried: Object.values(results).reduce((sum, r) => sum + r.retried, 0),
      totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors, 0),
    };

    logger.log("[CronSmsDeliveryTracking] 완료", summary);

    return NextResponse.json({
      ok: true,
      summary,
      results,
    });
  } catch (error) {
    logger.error("[CronSmsDeliveryTracking] 전체 오류", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
