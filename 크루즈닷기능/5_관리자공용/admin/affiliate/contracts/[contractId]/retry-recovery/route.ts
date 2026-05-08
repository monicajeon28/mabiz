export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/[contractId]/retry-recovery/route.ts
// DB 회수 재시도 API (관리자 전용)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { recoverBranchManagerDb, recoverSalesAgentDb } from '@/lib/scheduler/contractTerminationHandler';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { contractId: contractIdStr } = await params;
    const contractId = parseInt(contractIdStr);
    if (isNaN(contractId)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 계약서 ID입니다.' },
        { status: 400 }
      );
    }

    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (contract.status !== 'terminated') {
      return NextResponse.json(
        { ok: false, message: '해지된 계약서만 재시도할 수 있습니다.' },
        { status: 400 }
      );
    }

    const metadata = contract.metadata as any;
    if (metadata?.dbRecovered) {
      return NextResponse.json(
        { ok: false, message: '이미 DB가 회수된 계약서입니다.' },
        { status: 400 }
      );
    }

    const now = new Date();

    try {
      // 계약 타입에 따라 DB 회수 실행
      if (contract.AffiliateProfile?.type === 'BRANCH_MANAGER') {
        await recoverBranchManagerDb(contract, now);
      } else if (contract.AffiliateProfile?.type === 'SALES_AGENT') {
        await recoverSalesAgentDb(contract, now);
      } else {
        return NextResponse.json(
          { ok: false, message: '지원하지 않는 계약 타입입니다.' },
          { status: 400 }
        );
      }

      // 재시도 카운터 리셋
      await prisma.affiliateContract.update({
        where: { id: contractId },
        data: {
          metadata: {
            ...metadata,
            retryCount: 0,
            lastRetryAt: null,
            retryErrors: [],
            manuallyRetriedBy: sessionUser.id,
            manuallyRetriedAt: now.toISOString(),
          },
        },
      });

      // 감사 로그 기록
      await prisma.adminActionLog.create({
        data: {
          adminId: sessionUser.id,
          targetUserId: contract.userId || null,
          action: 'affiliate.contract.recovery_retried',
          details: {
            contractId,
            contractType: contract.AffiliateProfile?.type,
            previousRetryCount: metadata?.retryCount || 0,
            retriedAt: now.toISOString(),
          },
        },
      });

      return NextResponse.json({
        ok: true,
        message: 'DB 회수 재시도가 성공적으로 완료되었습니다.',
      });
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      const retryCount = (metadata?.retryCount || 0) + 1;

      // 에러 정보 업데이트
      await prisma.affiliateContract.update({
        where: { id: contractId },
        data: {
          metadata: {
            ...metadata,
            retryCount,
            lastRetryAt: now.toISOString(),
            retryErrors: [
              ...(metadata?.retryErrors || []),
              {
                attempt: retryCount,
                error: errorMessage,
                timestamp: now.toISOString(),
                manualRetry: true,
                retriedBy: sessionUser.id,
              },
            ],
          },
        },
      });

      return NextResponse.json(
        { 
          ok: false, 
          message: `DB 회수 재시도 실패: ${errorMessage}`,
          retryCount,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[POST /api/admin/affiliate/contracts/[contractId]/retry-recovery] error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'DB 회수 재시도 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
