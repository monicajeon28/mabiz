import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/menu-48/metrics/sms-performance
 *
 * SMS 시퀀스 Day별 성과
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    // Day별 SMS 발송 현황
    // TODO: 실제 SMS 전송 추적 테이블에서 계산
    // 현재는 예상값으로 설정
    const smsPerformance = [
      { day: 0, openRate: 72, clickRate: 35, conversionRate: 18 },
      { day: 1, openRate: 68, clickRate: 42, conversionRate: 24 },
      { day: 2, openRate: 65, clickRate: 45, conversionRate: 28 },
      { day: 3, openRate: 78, clickRate: 58, conversionRate: 38 },
    ];

    return NextResponse.json({ smsPerformance });
  } catch (error) {
    logger.error('[GET /api/menu-48/metrics/sms-performance]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
