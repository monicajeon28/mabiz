export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 정액제 판매원 계약서 삭제 (DB가 없을 때만 가능)
 */
export async function DELETE(
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
    const isTrial = metadata.isTrial === true;
    const profileId = contract.User_AffiliateContract_userIdToUser.AffiliateProfile?.id;

    // 무료 체험 중이고 데이터가 5% 미만인 경우 삭제 가능
    if (isTrial && profileId) {
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

      const totalDataCount = leadCount + saleCount + linkCount;
      const minimumThreshold = 35; // 최소 기준 데이터
      const fivePercentThreshold = Math.ceil(minimumThreshold * 0.05); // 5% = 약 2개

      // 5% 이상이면 삭제 불가
      if (totalDataCount >= fivePercentThreshold) {
        return NextResponse.json({
          ok: false,
          message: `데이터가 ${totalDataCount}개로 5% 이상(${fivePercentThreshold}개 이상)이므로 삭제할 수 없습니다. (고객: ${leadCount}건, 판매: ${saleCount}건, 링크: ${linkCount}건)`,
          hasDb: true,
          leadCount,
          saleCount,
          linkCount,
          totalCount: totalDataCount,
        }, { status: 400 });
      }

      // 5% 미만이면 삭제 가능 (무료 체험 중)
      await prisma.affiliateContract.delete({
        where: { id: contractId },
      });

      logger.log('[Admin Subscription Delete]', {
        contractId,
        adminId: sessionUser.id,
        isTrial: true,
        dataCount: totalDataCount,
        reason: '무료 체험 중 데이터 5% 미만',
      });

      return NextResponse.json({
        ok: true,
        message: `정액제 판매원 계약서가 삭제되었습니다. (데이터: ${totalDataCount}개)`,
      });
    }

    // 정식 구독 중이거나 무료 체험이 아닌 경우 기존 로직
    if (profileId) {
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

      if (leadCount > 0 || saleCount > 0) {
        return NextResponse.json({
          ok: false,
          message: `DB가 있어서 삭제할 수 없습니다. (고객 데이터: ${leadCount}건, 판매 데이터: ${saleCount}건)`,
          hasDb: true,
          leadCount,
          saleCount,
        }, { status: 400 });
      }
    }

    // DB가 없으면 삭제 가능
    await prisma.affiliateContract.delete({
      where: { id: contractId },
    });

    logger.log('[Admin Subscription Delete]', {
      contractId,
      adminId: sessionUser.id,
      hasDb: false,
    });

    return NextResponse.json({
      ok: true,
      message: '정액제 판매원 계약서가 삭제되었습니다.',
    });
  } catch (error: unknown) {
    logger.error('[Admin Subscription Delete API] Error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, message: '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
