export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 지급명세서 승인 API
 * POST /api/admin/payslips/[id]/approve
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const payslipId = parseInt(params.id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid payslip ID' },
        { status: 400 }
      );
    }

    // 지급명세서 조회
    const payslip = await prisma.affiliatePayslip.findUnique({
      where: { id: payslipId },
    });

    if (!payslip) {
      return NextResponse.json(
        { ok: false, error: '지급명세서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (payslip.status !== 'PENDING') {
      return NextResponse.json(
        { ok: false, error: '이미 처리된 지급명세서입니다.' },
        { status: 400 }
      );
    }

    // 승인 처리
    const updatedPayslip = await prisma.affiliatePayslip.update({
      where: { id: payslipId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: session.User.id,
      },
      include: {
        AffiliateProfile: {
          select: {
            displayName: true,
            type: true,
          },
        },
      },
    });

    console.log(
      `[Payslip Approve] Payslip ${payslipId} approved by ${session.User.name} (${session.User.id})`
    );

    return NextResponse.json({
      ok: true,
      message: '지급명세서가 승인되었습니다.',
      data: updatedPayslip,
    });
  } catch (error: any) {
    console.error('[Payslip Approve] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '승인 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
