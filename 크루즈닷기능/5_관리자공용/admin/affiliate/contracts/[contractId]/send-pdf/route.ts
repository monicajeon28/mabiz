export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/[contractId]/send-pdf/route.ts
// 관리자용 계약서 PDF 이메일 전송 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendContractPDFByEmail } from '@/lib/affiliate/contract-email';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ contractId: string }> }
) {
  try {
    // Next.js 15: params는 Promise이므로 await 필요
    const params = await props.params;
    const contractIdStr = params.contractId;

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) {
      return guard;
    }
    const contractId = parseInt(contractIdStr);
    if (isNaN(contractId)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid contract ID' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User_AffiliateContract_userIdToUser: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '계약서를 찾을 수 없습니다.' },
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 이메일 주소 확인 (계약서 기본정보의 이메일)
    const recipientEmail = contract.email || contract.User_AffiliateContract_userIdToUser?.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { ok: false, message: '계약서에 이메일 주소가 없습니다. 이메일을 입력해주세요.' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const recipientName = contract.name || contract.User_AffiliateContract_userIdToUser?.name || '계약자';
    const contractName = recipientName;

    // 본사 이메일 (CC로 추가)
    const headOfficeEmail = 'hyeseon28@gmail.com';

    // PDF 생성 및 이메일 전송 (계약자 이메일로 전송, 본사는 CC)
    const pdfResult = await sendContractPDFByEmail(
      contractId,
      recipientEmail,
      recipientName,
      `[계약서 PDF] ${contractName}님의 어필리에이트 계약서`,
      `
        <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
          <h2>계약서 PDF 전송</h2>
          <p>안녕하세요, ${recipientName}님,</p>
          <p>요청하신 어필리에이트 계약서 PDF를 전송드립니다.</p>
          <p>계약서 내용과 서명을 확인하시기 바랍니다.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            본 계약서는 전자적으로 생성되었으며, 서명이 포함되어 있습니다.
          </p>
        </div>
      `,
      headOfficeEmail // 본사 이메일을 CC로 추가
    );

    if (!pdfResult.success) {
      console.error('[Admin Contract Send PDF] PDF 전송 실패:', pdfResult.error);
      const errorMessage = pdfResult.error || '알 수 없는 오류';
      return NextResponse.json(
        {
          ok: false,
          message: `PDF 전송에 실패했습니다: ${errorMessage}`,
          error: errorMessage,
        },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'PDF가 성공적으로 전송되었습니다.',
        emailSent: true,
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error(`[Admin Contract Send PDF] error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Admin Contract Send PDF] Error details:', { errorMessage, errorStack });

    // JSON 응답이 항상 유효하도록 보장
    try {
      return NextResponse.json(
        {
          ok: false,
          message: `PDF 전송 중 오류가 발생했습니다: ${errorMessage}`,
          error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    } catch (jsonError) {
      // JSON 응답 생성 실패 시 텍스트 응답
      return new NextResponse(
        JSON.stringify({
          ok: false,
          message: `PDF 전송 중 오류가 발생했습니다: ${errorMessage}`,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
  }
}
