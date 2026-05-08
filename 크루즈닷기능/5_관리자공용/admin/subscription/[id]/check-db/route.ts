export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 정액제 판매원의 DB(고객 데이터) 존재 여부 확인
 */
export async function GET(
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
      include: {
        User_AffiliateContract_userIdToUser: {
          include: {
            AffiliateProfile: true,
          },
        },
      },
    });

    if (!contract || !contract.User_AffiliateContract_userIdToUser) {
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const profileId = contract.User_AffiliateContract_userIdToUser.AffiliateProfile?.id;
    if (!profileId) {
      return NextResponse.json({ ok: false, hasDb: false, count: 0 });
    }

    // 해당 판매원의 고객(리드) 수 확인
    const leadCount = await prisma.affiliateLead.count({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
    });

    // 판매 수 확인
    const saleCount = await prisma.affiliateSale.count({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
    });

    const totalDbCount = leadCount + saleCount;
    const hasDb = totalDbCount > 0;

    return NextResponse.json({
      ok: true,
      hasDb,
      leadCount,
      saleCount,
      totalCount: totalDbCount,
    });
  } catch (error: unknown) {
    logger.error('[Subscription Check DB API] Error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, message: 'DB 확인에 실패했습니다.' },
      { status: 500 }
    );
  }
}
