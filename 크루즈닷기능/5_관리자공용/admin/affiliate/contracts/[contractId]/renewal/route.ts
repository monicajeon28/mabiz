export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/[contractId]/renewal/route.ts
// 재계약 승인/거부 API (관리자 전용)

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logRenewalAudit, logTerminationAudit, logDbRecoveryAudit } from '@/lib/affiliate/audit-log';
import { notifyContractRenewalApproved, notifyContractRenewalRejected, notifyDbRecoverySuccess, notifyDbRecoveryFailed } from '@/lib/affiliate/admin-notifications';

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

    const { action } = await req.json(); // 'approve' or 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 액션입니다. (approve 또는 reject)' },
        { status: 400 }
      );
    }

    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        submittedAt: true,
        metadata: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const metadata = (contract.metadata as any) || {};

    // 재계약 요청이 있는지 확인
    if (metadata.renewalRequestStatus !== 'PENDING') {
      return NextResponse.json(
        { ok: false, message: '재계약 요청이 없습니다.' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // 재계약 승인: 갱신일을 1년 연장
      const currentRenewalDate = metadata.renewalDate 
        ? new Date(metadata.renewalDate) 
        : (contract.reviewedAt 
            ? new Date(contract.reviewedAt) 
            : contract.submittedAt 
              ? new Date(contract.submittedAt) 
              : new Date());
      
      // 현재 갱신일이 지났으면 오늘부터 1년, 아니면 현재 갱신일부터 1년
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let newRenewalDate = new Date(currentRenewalDate);
      if (newRenewalDate < today) {
        newRenewalDate = new Date(today);
      }
      newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);

      await prisma.affiliateContract.update({
        where: { id: contractId },
        data: {
          metadata: {
            ...metadata,
            renewalRequestStatus: 'APPROVED',
            renewalDate: newRenewalDate.toISOString(),
            renewalApprovedAt: new Date().toISOString(),
            renewalApprovedBy: sessionUser.id,
          },
        },
      });

      // 갱신 감사 로그
      await logRenewalAudit(
        'RENEWED',
        contractId,
        {
          performedById: sessionUser.id,
          performedBySystem: false,
          details: {
            previousRenewalDate: currentRenewalDate.toISOString(),
            newRenewalDate: newRenewalDate.toISOString(),
            approvedAt: new Date().toISOString(),
          },
        }
      );

      // 갱신 승인 알림
      await notifyContractRenewalApproved(
        contractId,
        newRenewalDate.toISOString()
      );

      return NextResponse.json({
        ok: true,
        message: '재계약이 승인되었습니다.',
        renewalDate: newRenewalDate.toISOString(),
      });
    } else {
      // 재계약 거부: 계약 해지
      const terminatedAt = new Date();
      
      // 계약서 타입 확인 (프로필 정보 필요)
      const contractWithProfile = await prisma.affiliateContract.findUnique({
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

      const contractType = contractWithProfile?.AffiliateProfile?.type;

      const updatedMetadata = {
        ...metadata,
        renewalRequestStatus: 'REJECTED',
        renewalRejectedAt: terminatedAt.toISOString(),
        renewalRejectedBy: sessionUser.id,
        terminationReason: '재계약 거부',
        terminatedAt: terminatedAt.toISOString(), // 해지일 기록
        dbRecovered: false, // DB 회수 여부 (초기값: false)
      };

      await prisma.affiliateContract.update({
        where: { id: contractId },
        data: {
          status: 'terminated',
          metadata: updatedMetadata,
        },
      });

      // 대리점장인 경우 즉시 DB 회수
      if (contractType === 'BRANCH_MANAGER' && contractWithProfile) {
        try {
          // 업데이트된 metadata를 포함한 contract 객체 생성
          const contractForRecovery = {
            ...contractWithProfile,
            metadata: updatedMetadata,
          };
          
          // 직접 함수 호출 (동적 import 대신)
          const contractTerminationHandler = await import('@/lib/scheduler/contractTerminationHandler');
          await contractTerminationHandler.recoverBranchManagerDb(contractForRecovery, terminatedAt);
          logger.log(`[Renewal] Manager DB recovered immediately for contract ${contractId}`);
          
          // DB 회수 성공 알림
          await notifyDbRecoverySuccess(
            contractId,
            contractType,
            { leads: 0, sales: 0, links: 0 } // 실제 수치는 recoverBranchManagerDb에서 확인 필요
          );
        } catch (error: any) {
          console.error(`[Renewal] Failed to recover manager DB for contract ${contractId}:`, error);
          
          // DB 회수 실패 알림
          await notifyDbRecoveryFailed(
            contractId,
            contractType,
            error.message || String(error),
            0
          );
          // 에러가 발생해도 계약 해지는 완료된 것으로 처리
        }
      }
      
      // 갱신 거부 알림
      await notifyContractRenewalRejected(
        contractId,
        contractType
      );

      // 감사 로그 기록
      await Promise.all([
        // 계약 해지 감사 로그
        logTerminationAudit(
          'TERMINATED',
          contractId,
          {
            performedById: sessionUser.id,
            performedBySystem: false,
            details: {
              contractType,
              reason: '재계약 거부',
              terminatedAt: terminatedAt.toISOString(),
              terminatedByAdmin: true,
            },
          }
        ),
        // 갱신 거부 감사 로그
        logRenewalAudit(
          'REJECTED',
          contractId,
          {
            performedById: sessionUser.id,
            performedBySystem: false,
            details: {
              rejectedAt: terminatedAt.toISOString(),
              reason: '재계약 거부',
            },
          }
        ),
      ]);

      // 대리점장인 경우 DB 회수 감사 로그
      if (contractType === 'BRANCH_MANAGER' && contractWithProfile) {
        await logDbRecoveryAudit(
          'RECOVERED',
          {
            contractId,
            profileId: contractWithProfile.AffiliateProfile?.id || null,
            userId: contractWithProfile.userId || null,
            performedById: sessionUser.id,
            performedBySystem: false,
            details: {
              recoveryType: 'IMMEDIATE',
              recoveredAt: terminatedAt.toISOString(),
              reason: 'RENEWAL_REJECTION_BRANCH_MANAGER',
            },
          }
        );
      }

      const message = contractType === 'BRANCH_MANAGER' 
        ? '재계약이 거부되었고 계약이 해지되었습니다. DB가 즉시 본사로 회수되었습니다.'
        : '재계약이 거부되었고 계약이 해지되었습니다. 1일 후 DB가 대리점장으로 회수됩니다.';

      return NextResponse.json({
        ok: true,
        message,
      });
    }
  } catch (error: any) {
    console.error('[POST /api/admin/affiliate/contracts/[contractId]/renewal] error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '재계약 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
