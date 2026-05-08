export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generatePayslipPDF, generatePayslipFileName } from '@/lib/affiliate/payslip-pdf';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 지급명세서 PDF 다운로드 API
 * GET /api/admin/payslips/[id]/pdf
 */
export async function GET(
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
          select: { id: true, role: true },
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
      include: {
        AffiliateProfile: {
          select: {
            displayName: true,
            type: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
          },
        },
      },
    });

    if (!payslip) {
      return NextResponse.json(
        { ok: false, error: '지급명세서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // PDF 생성
    const pdfBuffer = await generatePayslipPDF(payslip as any);
    const fileName = generatePayslipFileName(payslip as any);

    // Buffer를 Uint8Array로 변환하여 타입 에러 해결
    const pdfArray = new Uint8Array(pdfBuffer);

    return new NextResponse(pdfArray, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error: any) {
    console.error('[Payslip PDF] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'PDF 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
