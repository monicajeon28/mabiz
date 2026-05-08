export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    // Subscription 모델이 아직 없으므로, AffiliateContract에서 SUBSCRIPTION_AGENT 타입만 조회
    // TODO: Subscription 모델 생성 후 마이그레이션 필요
    const contracts = await prisma.affiliateContract.findMany({
      where: {
        metadata: {
          path: ['contractType'],
          equals: 'SUBSCRIPTION_AGENT',
        },
      },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            mallUserId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // contracts를 subscriptions 형태로 변환
    const subscriptions = contracts.map((contract) => {
      const metadata = contract.metadata as Record<string, unknown>;
      const startDate = contract.contractStartDate || contract.createdAt;
      const endDate = contract.contractEndDate || (() => {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + 2); // 기본 2개월
        return date;
      })();

      // nextBillingDate 계산
      let nextBillingDate = metadata?.nextBillingDate
        ? new Date(metadata.nextBillingDate as string)
        : (() => {
            const date = new Date(endDate);
            date.setMonth(date.getMonth() - 1); // 종료일 1개월 전
            return date;
          })();

      // nextBillingDate가 과거면 종료일로 설정
      if (nextBillingDate < new Date()) {
        nextBillingDate = new Date(endDate);
      }

      const isTrial = metadata?.isTrial === true;
      const trialEndDate = metadata?.trialEndDate ? new Date(metadata.trialEndDate as string) : null;
      const now = new Date();
      const isCurrentlyTrial = isTrial && trialEndDate && now < trialEndDate;

      return {
        id: contract.id,
        userId: contract.userId || 0,
        mallUserId: contract.User_AffiliateContract_userIdToUser?.mallUserId || `user_${contract.id}`,
        status: isCurrentlyTrial
          ? 'trial'
          : contract.status === 'completed'
            ? 'active'
            : contract.status === 'terminated'
              ? 'expired'
              : 'pending',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        autoRenew: metadata?.autoRenew !== false,
        isTrial: isCurrentlyTrial,
        trialEndDate: trialEndDate?.toISOString() || null,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString(),
        user: contract.User_AffiliateContract_userIdToUser || {
          id: contract.userId || 0,
          name: contract.name,
          phone: contract.phone,
          email: contract.email,
        },
      };
    });

    return NextResponse.json({
      ok: true,
      subscriptions,
    });
  } catch (error) {
    logger.error('[Subscription List API] Error:', error);
    return NextResponse.json(
      { ok: false, message: '구독 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
