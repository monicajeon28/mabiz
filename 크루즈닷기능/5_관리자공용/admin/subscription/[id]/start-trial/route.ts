export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const contractId = parseInt(id);

    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const metadata = (contract.metadata as Record<string, unknown>) ?? {};

    // 이미 무료 체험이 시작되었는지 확인
    if (metadata.isTrial === true && metadata.trialEndDate) {
      const trialEndDate = new Date(metadata.trialEndDate as string);
      if (new Date() < trialEndDate) {
        return NextResponse.json({ ok: false, message: '이미 무료 체험이 진행 중입니다.' }, { status: 400 });
      }
    }

    // 무료 체험 기간 설정 (7일)
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7일 후

    // 정식 구독 시작일 (체험 종료일)
    const subscriptionStartDate = new Date(trialEndDate);
    const subscriptionEndDate = new Date(subscriptionStartDate);
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // 1개월

    // 계약서 업데이트
    await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        contractStartDate: trialStartDate,
        contractEndDate: subscriptionEndDate,
        status: 'submitted', // 체험 중 상태
        metadata: {
          ...metadata,
          contractType: 'SUBSCRIPTION_AGENT',
          isTrial: true,
          trialStartDate: trialStartDate.toISOString(),
          trialEndDate: trialEndDate.toISOString(),
          subscriptionStartDate: subscriptionStartDate.toISOString(),
          subscriptionEndDate: subscriptionEndDate.toISOString(),
          nextBillingDate: trialEndDate.toISOString(), // 체험 종료일이 결제일
          paymentAmount: 300000, // 30만원
          paymentRequired: true,
        },
      },
    });

    logger.log('[Subscription Start Trial]', {
      contractId,
      trialStartDate: trialStartDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      subscriptionStartDate: subscriptionStartDate.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: '무료 체험이 시작되었습니다. (7일)',
      trialEndDate: trialEndDate.toISOString(),
    });
  } catch (error: unknown) {
    logger.error('[Subscription Start Trial API] Error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, message: '무료 체험 시작에 실패했습니다.' },
      { status: 500 }
    );
  }
}
