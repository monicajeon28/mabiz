export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 정액제 판매원의 데이터 사용량 확인 (무료 체험 중일 때만)
 * 5% 미만이면 삭제 가능
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

    const metadata = (contract.metadata as Record<string, unknown>) ?? {};

    // 무료 체험 중인지 확인
    const isTrial = metadata.isTrial === true;
    if (!isTrial) {
      return NextResponse.json({
        ok: false,
        message: '무료 체험 중인 계정만 데이터 사용량을 확인할 수 있습니다.',
      }, { status: 400 });
    }

    const profileId = contract.User_AffiliateContract_userIdToUser.AffiliateProfile?.id;
    if (!profileId) {
      return NextResponse.json({
        ok: true,
        canDelete: true,
        dataUsage: 0,
        message: '프로필이 없어 삭제 가능합니다.',
      });
    }

    // 데이터 사용량 확인
    const leadCount = await prisma.affiliateLead.count({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
    });

    const saleCount = await prisma.affiliateSale.count({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
    });

    const linkCount = await prisma.affiliateLink.count({
      where: {
        OR: [
          { agentId: profileId },
          { managerId: profileId },
        ],
      },
    });

    // 전체 데이터 수
    const totalDataCount = leadCount + saleCount + linkCount;

    // 기준: 최소 데이터 기준 (예: 리드 20개, 판매 5개, 링크 10개 = 총 35개)
    // 5% 미만이면 삭제 가능
    const minimumThreshold = 35; // 최소 기준 데이터
    const fivePercentThreshold = Math.ceil(minimumThreshold * 0.05); // 5% = 약 2개

    const canDelete = totalDataCount < fivePercentThreshold;
    const dataUsagePercent = minimumThreshold > 0
      ? (totalDataCount / minimumThreshold) * 100
      : 0;

    return NextResponse.json({
      ok: true,
      canDelete,
      dataUsage: totalDataCount,
      dataUsagePercent: Math.min(dataUsagePercent, 100),
      threshold: fivePercentThreshold,
      details: {
        leadCount,
        saleCount,
        linkCount,
        totalCount: totalDataCount,
      },
      message: canDelete
        ? `데이터가 ${totalDataCount}개로 5% 미만(${fivePercentThreshold}개 미만)이므로 삭제 가능합니다.`
        : `데이터가 ${totalDataCount}개로 5% 이상(${fivePercentThreshold}개 이상)이므로 삭제할 수 없습니다.`,
    });
  } catch (error: unknown) {
    logger.error('[Subscription Check Data Usage API] Error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, message: '데이터 사용량 확인에 실패했습니다.' },
      { status: 500 }
    );
  }
}
