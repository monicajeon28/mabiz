export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/[contractId]/terminate/route.ts
// 계약 해지 API (관리자 전용) - 계약 위반 등 즉시 해지용

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logTerminationAudit, logDbRecoveryAudit } from '@/lib/affiliate/audit-log';
import { notifyContractTerminated, notifyDbRecoverySuccess, notifyDbRecoveryFailed } from '@/lib/affiliate/admin-notifications';

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

    const { reason } = await req.json().catch(() => ({}));
    const terminationReason = reason || '관리자에 의한 계약 해지';

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

    // 이미 해지된 경우
    if (contract.status === 'terminated') {
      return NextResponse.json(
        { ok: false, message: '이미 해지된 계약서입니다.' },
        { status: 400 }
      );
    }

    const metadata = (contract.metadata as any) || {};
    const terminatedAt = new Date();

    // 계약 해지 처리
    await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'terminated',
        metadata: {
          ...metadata,
          terminationReason,
          terminatedAt: terminatedAt.toISOString(),
          terminatedBy: sessionUser.id,
          terminatedByAdmin: true,
          dbRecovered: false,
        },
      },
    });

    // 대리점장인 경우 즉시 DB 회수
    if (contract.AffiliateProfile?.type === 'BRANCH_MANAGER') {
      try {
        const { recoverBranchManagerDb } = await import('@/lib/scheduler/contractTerminationHandler');
        const contractForRecovery = {
          ...contract,
          metadata: {
            ...metadata,
            terminationReason,
            terminatedAt: terminatedAt.toISOString(),
            terminatedBy: sessionUser.id,
            terminatedByAdmin: true,
            dbRecovered: false,
          },
        };
        await recoverBranchManagerDb(contractForRecovery, terminatedAt);
        logger.log(`[Terminate] Manager DB recovered immediately for contract ${contractId}`);
        
        // DB 회수 성공 알림
        await notifyDbRecoverySuccess(
          contractId,
          contract.AffiliateProfile.type,
          { leads: 0, sales: 0, links: 0 } // 실제 수치는 recoverBranchManagerDb에서 확인 필요
        );
      } catch (error: any) {
        console.error(`[Terminate] Failed to recover manager DB for contract ${contractId}:`, error);
        
        // DB 회수 실패 알림
        await notifyDbRecoveryFailed(
          contractId,
          contract.AffiliateProfile?.type || 'UNKNOWN',
          error.message || String(error),
          0
        );
        // 에러가 발생해도 계약 해지는 완료된 것으로 처리
      }
    }
    
    // 계약 해지 알림
    await notifyContractTerminated(
      contractId,
      contract.AffiliateProfile?.type || 'UNKNOWN',
      terminationReason,
      contract.userId || null
    );

    // 감사 로그 기록 (AdminActionLog + AffiliateAuditLog)
    await Promise.all([
      // 관리자 작업 로그
      prisma.adminActionLog.create({
        data: {
          adminId: sessionUser.id,
          targetUserId: contract.userId || null,
          action: 'affiliate.contract.terminated',
          details: {
            contractId,
            contractType: contract.AffiliateProfile?.type,
            reason: terminationReason,
            terminatedAt: terminatedAt.toISOString(),
          },
        },
      }),
      // 계약 해지 감사 로그
      logTerminationAudit(
        'TERMINATED',
        contractId,
        {
          performedById: sessionUser.id,
          performedBySystem: false,
          details: {
            contractType: contract.AffiliateProfile?.type,
            reason: terminationReason,
            terminatedAt: terminatedAt.toISOString(),
            terminatedByAdmin: true,
          },
        }
      ),
    ]);

    // 대리점장인 경우 DB 회수 감사 로그
    if (contract.AffiliateProfile?.type === 'BRANCH_MANAGER') {
      await logDbRecoveryAudit(
        'RECOVERED',
        {
          contractId,
          profileId: contract.AffiliateProfile.id,
          userId: contract.userId || null,
          performedById: sessionUser.id,
          performedBySystem: false,
          details: {
            recoveryType: 'IMMEDIATE',
            recoveredAt: terminatedAt.toISOString(),
            reason: 'BRANCH_MANAGER_TERMINATION',
          },
        }
      );
    }

    const message = contract.AffiliateProfile?.type === 'BRANCH_MANAGER' 
      ? '계약이 해지되었습니다. DB가 즉시 본사로 회수되었습니다.'
      : '계약이 해지되었습니다. 1일 후 DB가 대리점장으로 회수됩니다.';

    return NextResponse.json({
      ok: true,
      message,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/affiliate/contracts/[contractId]/terminate] error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '계약 해지 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
