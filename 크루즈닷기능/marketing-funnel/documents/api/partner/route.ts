export const dynamic = 'force-dynamic';

// 파트너 인증서 승인 요청 API
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/partner-auth';
import { notifyAdminOfApprovalRequest } from '@/lib/notifications/certificateNotifications';

// GET: 승인 요청 조회
export async function GET(req: NextRequest) {
  try {
    const { sessionUser, profile } = await requirePartnerContext();

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const certificateType = searchParams.get('type');
    const status = searchParams.get('status');

    const where: any = {
      requesterId: sessionUser.id,
    };

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (certificateType) {
      where.certificateType = certificateType;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // status가 'all'인 경우 모든 승인 요청 목록 반환
    if (status === 'all') {
      const approvals = await prisma.certificateApproval.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          Requester: {
            select: {
              id: true,
              name: true,
              AffiliateProfile: {
                select: {
                  type: true,
                  displayName: true,
                  branchLabel: true,
                },
              },
            },
          },
          Approver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json({
        ok: true,
        approvals,
      });
    }

    // 최신 승인 요청 조회 (단일)
    const approval = await prisma.certificateApproval.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        Approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      approval,
    });
  } catch (error: any) {
    console.error('[Certificate Approvals GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '조회 실패' },
      { status: error.status || 500 }
    );
  }
}

// POST: 승인 요청 생성
export async function POST(req: NextRequest) {
  try {
    const { sessionUser, profile } = await requirePartnerContext();

    const body = await req.json();
    const {
      certificateType,
      customerId,
      customerName,
      customerEmail,
      birthDate,
      productName,
      paymentAmount,
      paymentDate,
      refundAmount,
      refundDate,
      metadata,
    } = body;

    // 필수 필드 검증
    if (!certificateType || !customerId || !customerName || !productName || !paymentAmount || !paymentDate) {
      return NextResponse.json(
        { ok: false, error: '필수 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 환불인증서인 경우 환불 정보 검증
    if (certificateType === 'refund') {
      if (!refundAmount || !refundDate) {
        return NextResponse.json(
          { ok: false, error: '환불금액과 환불일자를 입력해주세요.' },
          { status: 400 }
        );
      }
    }

    // 권한 확인
    const requesterType = profile.type; // 'BRANCH_MANAGER' | 'SALES_AGENT'

    // 대리점장이 구매확인증서를 요청하는 경우 - 자동 승인
    const autoApprove = requesterType === 'BRANCH_MANAGER' && certificateType === 'purchase';

    // 승인 요청 생성
    const approval = await prisma.certificateApproval.create({
      data: {
        certificateType,
        requesterId: sessionUser.id,
        requesterType,
        customerId,
        customerName,
        customerEmail,
        birthDate,
        productName,
        paymentAmount,
        paymentDate,
        refundAmount,
        refundDate,
        status: autoApprove ? 'approved' : 'pending',
        approvedBy: autoApprove ? sessionUser.id : null,
        approvedByType: autoApprove ? 'BRANCH_MANAGER' : null,
        approvedAt: autoApprove ? new Date() : null,
        metadata,
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // 환불 인증서인 경우 고객의 환불 인증 카운터 증가
    if (certificateType === 'refund') {
      await prisma.user.update({
        where: { id: customerId },
        data: {
          refundCertificateCount: {
            increment: 1,
          },
        },
      });
    }

    console.log('[Certificate Approval] Created:', {
      id: approval.id,
      type: certificateType,
      requester: sessionUser.name,
      requesterType,
      customer: customerName,
      autoApproved: autoApprove,
    });

    // 자동 승인이 아닌 경우 관리자에게 알림
    if (!autoApprove) {
      notifyAdminOfApprovalRequest(approval.id).catch((err) => {
        console.error('[Certificate Approval] Notification failed:', err);
      });
    }

    return NextResponse.json({
      ok: true,
      approval,
      message: autoApprove ? '자동 승인되었습니다.' : '승인 요청이 제출되었습니다.',
    });
  } catch (error: any) {
    console.error('[Certificate Approvals POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '승인 요청 실패' },
      { status: 500 }
    );
  }
}
