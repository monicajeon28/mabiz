export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { scheduleOnboardingSms } from '@/lib/cron/sms-onboarding-cron';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/onboarding-sms
 *
 * 목적:
 * - Vercel Cron 또는 외부 스케줄러 (Zapier, AWS EventBridge)에서 호출
 * - 매일 09:00 KST에 미분류 고객 500명에게 온보딩 SMS 발송
 *
 * 보안:
 * - Authorization Bearer 토큰 검증
 * - (Vercel Cron은 자동으로 CRON_SECRET 추가)
 *
 * 응답:
 * {
 *   "ok": true,
 *   "timestamp": "2026-05-22T09:00:00Z",
 *   "totalProcessed": 500,
 *   "day0Sent": 500,
 *   "day1Sent": 150,
 *   "day2Sent": 50,
 *   "day3Sent": 10,
 *   "totalFailed": 0,
 *   "duration": "2340ms",
 *   "stats": { ... }
 * }
 */

export async function GET(req: NextRequest) {
  // Vercel Cron 보안 검증
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[OnboardingCronApi] CRON_SECRET 환경변수 미설정');
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }
  const token = req.headers.get('authorization');
  const providedSecret = token?.startsWith('Bearer ') ? token.slice(7) : '';
  if (providedSecret !== cronSecret) {
    logger.error('[OnboardingCronApi] 인증 실패');
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('[OnboardingCronApi] 시작');

    // Cron 실행
    const result = await scheduleOnboardingSms();

    logger.info('[OnboardingCronApi] 완료', result);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    logger.error('[OnboardingCronApi] 오류', { error });
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * Vercel cron 설정 (vercel.json)
 *
 * "crons": [
 *   {
 *     "path": "/api/cron/onboarding-sms",
 *     "schedule": "0 9 * * *"
 *   }
 * ]
 *
 * OR 외부 스케줄러 설정:
 * - Zapier: 매일 09:00 KST → GET https://your-domain.com/api/cron/onboarding-sms
 *   Header: Authorization: Bearer CRON_SECRET
 * - AWS EventBridge: cron(0 0 * * ? *) → invoke Lambda → HTTP POST
 */
