export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 무료 체험이 종료된 사용자들의 결제 처리
 * Cron Job에서 호출 (매일 실행)
 * POST /api/admin/subscription/check-trial-payment
 */
export async function POST(req: Request) {
  try {
    // Cron Job 인증 (CRON_SECRET 검증)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 무료 체험이 오늘 종료되는 계약서 조회
    const contracts = await prisma.affiliateContract.findMany({
      where: {
        metadata: {
          path: ['isTrial'],
          equals: true,
        },
      },
      include: {
        user: true,
      },
    });

    type TrialMetadata = {
      isTrial?: boolean;
      trialEndDate?: string;
      subscriptionStartDate?: string;
      subscriptionEndDate?: string;
      [key: string]: unknown;
    };

    const expiredTrials = contracts.filter((contract) => {
      const metadata = (contract.metadata as TrialMetadata) || {};
      const trialEndDate = metadata.trialEndDate ? new Date(metadata.trialEndDate) : null;
      if (!trialEndDate) return false;

      trialEndDate.setHours(0, 0, 0, 0);
      return trialEndDate.getTime() === now.getTime();
    });

    logger.log('[Check Trial Payment]', {
      totalTrials: contracts.length,
      expiredToday: expiredTrials.length,
    });

    const results = [];

    for (const contract of expiredTrials) {
      const metadata = (contract.metadata as TrialMetadata) || {};

      // 결제 처리 (페이앱 연동 필요)
      // TODO: 실제 페이앱 결제 API 호출
      // 현재는 결제 대기 상태로 설정

      const subscriptionStartDate = metadata.subscriptionStartDate
        ? new Date(metadata.subscriptionStartDate)
        : new Date();
      const subscriptionEndDate = metadata.subscriptionEndDate
        ? new Date(metadata.subscriptionEndDate)
        : (() => {
            const date = new Date(subscriptionStartDate);
            date.setMonth(date.getMonth() + 1);
            return date;
          })();

      // 결제 대기 상태로 업데이트
      await prisma.affiliateContract.update({
        where: { id: contract.id },
        data: {
          status: 'submitted', // 결제 대기 상태
          contractStartDate: subscriptionStartDate,
          contractEndDate: subscriptionEndDate,
          metadata: {
            ...metadata,
            isTrial: false,
            trialEndedAt: now.toISOString(),
            paymentStatus: 'pending',
            paymentRequired: true,
          },
        },
      });

      results.push({
        contractId: contract.id,
        userId: contract.userId,
        status: 'payment_required',
      });

      logger.log('[Trial Expired]', {
        contractId: contract.id,
        userId: contract.userId,
        paymentRequired: true,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `${expiredTrials.length}명의 무료 체험이 종료되었습니다.`,
      results,
    });
  } catch (error) {
    logger.error('[Check Trial Payment API] Error:', error);
    return NextResponse.json(
      { ok: false, message: '체험 종료 확인에 실패했습니다.' },
      { status: 500 }
    );
  }
}
