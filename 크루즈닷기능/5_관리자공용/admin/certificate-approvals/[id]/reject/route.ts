export const dynamic = 'force-dynamic';

// 관리자/대리점장 승인 거부 API
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { notifyRequesterOfRejection } from '@/lib/notifications/certificateNotifications';

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
    const body = await req.json();
    const { reason } = body;

    if (isNaN(approvalId)) {
      return NextResponse.json(
        { ok: false, error: '잘못된 승인 요청 ID입니다.' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { ok: false, error: '거부 사유를 입력해주세요.' },
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

    // 권한 확인 (승인과 동일)
    let approverType: string;
    
    if (user.role === 'admin') {
      approverType = 'ADMIN';
    } else {
      const approverProfile = await prisma.affiliateProfile.findUnique({
        where: { userId: user.id },
      });

      if (!approverProfile || approverProfile.type !== 'BRANCH_MANAGER') {
        return NextResponse.json(
          { ok: false, error: '거부 권한이 없습니다.' },
          { status: 403 }
        );
      }

      approverType = 'BRANCH_MANAGER';

      if (approval.certificateType === 'refund') {
        return NextResponse.json(
          { ok: false, error: '환불인증서는 본사만 처리할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // 거부 처리
    const updatedApproval = await prisma.certificateApproval.update({
      where: { id: approvalId },
      data: {
        status: 'rejected',
        approvedBy: user.id,
        approvedByType: approverType,
        approvedAt: new Date(),
        rejectedReason: reason,
      },
      include: {
        Requester: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log('[Certificate Approval] Rejected:', {
      id: approvalId,
      type: approval.certificateType,
      approver: user.name,
      approverType,
      requester: approval.Requester.name,
      reason,
    });

    // 요청자에게 거부 알림 발송
    notifyRequesterOfRejection(approvalId).catch((err) => {
      console.error('[Certificate Rejection] Notification failed:', err);
    });

    return NextResponse.json({
      ok: true,
      approval: updatedApproval,
      message: '거부되었습니다.',
    });
  } catch (error: any) {
    console.error('[Certificate Rejection] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '거부 처리 실패' },
      { status: 500 }
    );
  }
}
