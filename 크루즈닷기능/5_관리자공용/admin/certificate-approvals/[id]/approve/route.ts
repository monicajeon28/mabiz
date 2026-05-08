export const dynamic = 'force-dynamic';

// 관리자/대리점장 승인 처리 API
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { notifyRequesterOfApproval } from '@/lib/notifications/certificateNotifications';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id: idStr } = await params;
    const approvalId = parseInt(idStr);

    if (isNaN(approvalId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 승인 요청 ID입니다.' },
        { status: 400 }
      );
    }

    // 승인 요청 조회
    const approval = await prisma.certificateApproval.findUnique({
      where: { id: approvalId },
      include: {
        Requester: {
          select: {
            id: true,
            name: true,
            AffiliateProfile: {
              select: {
                type: true,
              },
            },
          },
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { ok: false, error: '승인 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { ok: false, error: '이미 처리된 요청입니다.' },
        { status: 400 }
      );
    }

    // 권한 확인
    let approverType: string;
    
    if (user.role === 'admin') {
      approverType = 'ADMIN';
    } else {
      // 대리점장인지 확인
      const approverProfile = await prisma.affiliateProfile.findUnique({
        where: { userId: user.id },
      });

      if (!approverProfile || approverProfile.type !== 'BRANCH_MANAGER') {
        return NextResponse.json(
          { ok: false, error: '승인 권한이 없습니다.' },
          { status: 403 }
        );
      }

      approverType = 'BRANCH_MANAGER';

      // 대리점장은 판매원의 구매확인증서만 승인 가능
      if (approval.certificateType === 'refund') {
        return NextResponse.json(
          { ok: false, error: '환불인증서는 본사만 승인할 수 있습니다.' },
          { status: 403 }
        );
      }

      if (approval.Requester.AffiliateProfile?.type !== 'SALES_AGENT') {
        return NextResponse.json(
          { ok: false, error: '판매원의 요청만 승인할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // 승인 처리
    const updatedApproval = await prisma.certificateApproval.update({
      where: { id: approvalId },
      data: {
        status: 'approved',
        approvedBy: user.id,
        approvedByType: approverType,
        approvedAt: new Date(),
      },
      include: {
        Requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 환불 인증서인 경우 고객의 환불 인증 카운터 증가 (업데이트 시마다 증가)
    if (approval.certificateType === 'refund') {
      await prisma.user.update({
        where: { id: approval.customerId },
        data: {
          refundCertificateCount: {
            increment: 1,
          },
        },
      });
    }

    console.log('[Certificate Approval] Approved:', {
      id: approvalId,
      type: approval.certificateType,
      approver: user.name,
      approverType,
      requester: approval.Requester.name,
      customer: approval.customerName,
    });

    // 요청자에게 승인 알림 발송
    notifyRequesterOfApproval(approvalId).catch((err) => {
      console.error('[Certificate Approval] Notification failed:', err);
    });

    return NextResponse.json({
      ok: true,
      approval: updatedApproval,
      message: '승인되었습니다.',
    });
  } catch (error: any) {
    console.error('[Certificate Approval] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '승인 처리 실패' },
      { status: 500 }
    );
  }
}
