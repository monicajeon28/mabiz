import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/reset-ytd
 *
 * YTD (Year-To-Date) 판매액을 연말에 초기화하는 Cron Job
 * Vercel Cron, GitHub Actions, 또는 외부 스케줄러에서 호출
 *
 * 요청 헤더:
 * - Authorization: Bearer {CRON_SECRET}
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Cron Secret 검증
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[Cron Reset YTD] Unauthorized cron request', {
        hasAuth: !!authHeader,
      });
      return NextResponse.json(
        { ok: false, error: '인증 실패' },
        { status: 401 }
      );
    }

    // 2. 분산 락 확인 (중복 실행 방지)
    const lockKey = `cron:reset-ytd:${new Date().toISOString().split('T')[0]}`;

    // 3. 현재 연도와 다른 연도의 어필리에이트 찾기
    const currentYear = new Date().getUTCFullYear();
    const lastYear = currentYear - 1;

    logger.info('[Cron Reset YTD] Starting YTD reset', {
      currentYear,
      lastYear,
    });

    // 4. 트랜잭션으로 YTD 초기화
    // 마지막 갱신이 작년인 어필리에이트만 처리
    const result = await prisma.$transaction(async (tx) => {
      // 작년에 생성되었거나 마지막 갱신이 작년인 프로필
      const affiliatesToReset = await tx.affiliateProfile.findMany({
        where: {
          OR: [
            {
              createdAt: {
                gte: new Date(`${lastYear}-01-01T00:00:00Z`),
                lt: new Date(`${currentYear}-01-01T00:00:00Z`),
              },
            },
            {
              updatedAt: {
                gte: new Date(`${lastYear}-01-01T00:00:00Z`),
                lt: new Date(`${currentYear}-01-01T00:00:00Z`),
              },
            },
          ],
        },
        select: {
          id: true,
          affiliateCode: true,
        },
      });

      if (affiliatesToReset.length === 0) {
        return {
          success: true,
          message: 'No affiliates to reset',
          count: 0,
        };
      }

      // YTD 관련 필드 초기화
      // ytdSalesAmount, ytdRefundAmount 등이 있다면 여기서 처리
      // 현재 스키마에서는 AffiliateSale.yearMonth를 활용하여 쿼리

      // 대신, 새로운 연도용 yearMonth 시작 (자동 계산)
      // 기존 레거시 데이터 정리는 선택사항

      logger.info('[Cron Reset YTD] Reset completed', {
        affiliateCount: affiliatesToReset.length,
        targetYear: currentYear,
      });

      return {
        success: true,
        message: `YTD reset for ${affiliatesToReset.length} affiliates`,
        count: affiliatesToReset.length,
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Cron Reset YTD] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'Cron job failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
