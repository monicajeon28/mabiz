export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface ExtendBody {
  months?: number;
  free?: boolean;
}

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
    const subscriptionId = parseInt(id);
    const body: ExtendBody = await req.json();
    const months = body.months ?? 1;
    const free = body.free ?? false;

    // TODO: Subscription 모델 생성 후 실제 데이터 업데이트
    // 현재는 AffiliateContract의 metadata를 업데이트
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: subscriptionId },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: '구독을 찾을 수 없습니다.' }, { status: 404 });
    }

    const metadata = (contract.metadata as Record<string, unknown>) ?? {};
    const currentEndDate = contract.contractEndDate ?? new Date();
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    await prisma.affiliateContract.update({
      where: { id: subscriptionId },
      data: {
        contractEndDate: newEndDate,
        metadata: {
          ...metadata,
          lastExtendedAt: new Date().toISOString(),
          extendedMonths: ((metadata.extendedMonths as number) || 0) + months,
          freeExtension: free,
        },
      },
    });

    logger.log('[Subscription Extend]', {
      subscriptionId,
      months,
      free,
      newEndDate: newEndDate.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: `${months}개월 연장이 완료되었습니다.`,
    });
  } catch (error: unknown) {
    logger.error('[Subscription Extend API] Error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, message: '연장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
