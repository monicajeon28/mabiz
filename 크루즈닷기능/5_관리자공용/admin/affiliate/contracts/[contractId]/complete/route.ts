export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/[contractId]/complete/route.ts
// 관리자 패널에서 계약서 완료 승인 API (PDF 전송만, 아이디 생성 없음)

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendContractPDFByEmail } from '@/lib/affiliate/contract-email';
import { uploadContractPDFToDrive, uploadDocumentToDrive } from '@/lib/affiliate/document-drive-sync';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ contractId: string }> }
) {
  try {
    const params = await props.params;
    const contractIdStr = params.contractId;
    const contractId = Number(contractIdStr);

    if (!contractId || Number.isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (admin?.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Admin access required' },
        {
          status: 403,
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
      return NextResponse.json({ ok: false, message: '계약서를 찾을 수 없습니다.' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 계약서가 이미 완료된 경우
    if (contract.status === 'completed') {
      return NextResponse.json({ ok: false, message: '이미 완료된 계약서입니다.' }, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 계약서가 서명되지 않은 경우
    const metadata = contract.metadata as any;
    const signatures = metadata?.signatures || {};
    const hasSignature = signatures.main?.url || signatures.education?.url || signatures.b2b?.url;

    if (!hasSignature) {
      return NextResponse.json({ ok: false, message: '서명이 완료되지 않은 계약서입니다.' }, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 이메일 주소 확인
    const recipientEmail = contract.email || contract.User_AffiliateContract_userIdToUser?.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { ok: false, message: '계약서에 이메일 주소가 없습니다. 이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 계약서 상태를 'completed'로 변경 (아이디 생성 없음)
    await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        status: 'completed',
        metadata: {
          ...metadata,
          completedBy: sessionUser.id,
          completedAt: new Date().toISOString(),
          completedByAdmin: true,
        },
      },
    });

    // PDF 생성 및 이메일 전송
    const recipientName = contract.name || contract.User_AffiliateContract_userIdToUser?.name || '계약자';

    // 계약자에게 PDF 전송
    const pdfResult = await sendContractPDFByEmail(
      contractId,
      recipientEmail,
      recipientName,
      `[계약서 완료] 어필리에이트 계약서`,
      `
        <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
          <h2>계약서가 완료되었습니다</h2>
          <p>안녕하세요, ${recipientName}님,</p>
          <p>귀하의 어필리에이트 계약서가 완료되어 PDF로 전송드립니다.</p>
          <p>계약서 내용과 서명을 확인하시기 바랍니다.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            본 계약서는 전자적으로 생성되었으며, 서명이 포함되어 있습니다.
          </p>
        </div>
      `
    );

    // 본사 이메일로도 PDF 전송 (비동기, 실패해도 계속 진행)
    const headOfficeEmail = process.env.HEAD_OFFICE_EMAIL || process.env.ADMIN_EMAIL || 'hyeseon28@gmail.com';
    sendContractPDFByEmail(
      contractId,
      headOfficeEmail,
      '크루즈닷 본사',
      `[계약서 완료] ${recipientName}님의 어필리에이트 계약서`,
      `
        <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">
          <h2>계약서가 완료되었습니다</h2>
          <p>${recipientName}님의 어필리에이트 계약서가 완료되어 PDF로 전송드립니다.</p>
          <p>계약서 내용과 서명을 확인하시기 바랍니다.</p>
        </div>
      `
    ).catch((err) => {
      console.error('[Admin Contract Complete] 본사 이메일 전송 실패:', err);
    });

    // 📦 구글 드라이브에 계약서 PDF 및 관련 문서 백업
    let pdfUrl: string | null = null;
    if (contract.invitedByProfileId) {
      logger.log('[Admin Contract Complete] 구글 드라이브 백업 시작...');

      // 1. 계약서 PDF 업로드
      const pdfUploadResult = await uploadContractPDFToDrive(contractId);
      if (pdfUploadResult.ok) {
        pdfUrl = pdfUploadResult.url;
        logger.log('[Admin Contract Complete] 계약서 PDF 구글 드라이브 업로드 성공:', pdfUploadResult.url);

        // PDF URL을 metadata에 저장
        await prisma.affiliateContract.update({
          where: { id: contractId },
          data: {
            metadata: {
              ...metadata,
              pdfUrl: pdfUrl,
              pdfBackupUrl: pdfUploadResult.backupUrl || null,
              pdfFileName: pdfUploadResult.fileName || null,
            },
          },
        });
      } else {
        console.error('[Admin Contract Complete] 계약서 PDF 구글 드라이브 업로드 실패:', pdfUploadResult.error);
      }

      // 2. 신분증 업로드 (있는 경우)
      if (contract.idCardPath) {
        try {
          const idCardFilePath = join(process.cwd(), 'public', contract.idCardPath);
          const idCardBuffer = await readFile(idCardFilePath);
          const idCardUploadResult = await uploadDocumentToDrive({
            profileId: contract.invitedByProfileId,
            documentType: 'ID_CARD',
            buffer: idCardBuffer,
            fileName: contract.idCardOriginalName || 'id_card.jpg',
            mimeType: 'image/jpeg',
          });
          if (idCardUploadResult.ok) {
            logger.log('[Admin Contract Complete] 신분증 구글 드라이브 업로드 성공:', idCardUploadResult.url);
          } else {
            console.error('[Admin Contract Complete] 신분증 구글 드라이브 업로드 실패:', idCardUploadResult.error);
          }
        } catch (idCardError: any) {
          console.error('[Admin Contract Complete] 신분증 읽기 실패:', idCardError);
        }
      }

      // 3. 통장 사본 업로드 (있는 경우)
      if (contract.bankbookPath) {
        try {
          const bankbookFilePath = join(process.cwd(), 'public', contract.bankbookPath);
          const bankbookBuffer = await readFile(bankbookFilePath);
          const bankbookUploadResult = await uploadDocumentToDrive({
            profileId: contract.invitedByProfileId,
            documentType: 'BANKBOOK',
            buffer: bankbookBuffer,
            fileName: contract.bankbookOriginalName || 'bankbook.jpg',
            mimeType: 'image/jpeg',
          });
          if (bankbookUploadResult.ok) {
            logger.log('[Admin Contract Complete] 통장 사본 구글 드라이브 업로드 성공:', bankbookUploadResult.url);
          } else {
            console.error('[Admin Contract Complete] 통장 사본 구글 드라이브 업로드 실패:', bankbookUploadResult.error);
          }
        } catch (bankbookError: any) {
          console.error('[Admin Contract Complete] 통장 사본 읽기 실패:', bankbookError);
        }
      }
    }

    // 계약서 타입 가져오기 (기존 metadata 변수 사용)
    const contractType = metadata?.contractType || 'SALES_AGENT';

    // 이메일 전송 실패해도 계약서 완료는 성공으로 처리
    if (!pdfResult.success) {
      console.error('[Admin Contract Complete] PDF 전송 실패:', pdfResult.error);
      return NextResponse.json({
        ok: true,
        message: '계약서가 완료되었으나 이메일 전송에 실패했습니다.',
        emailSent: false,
        error: pdfResult.error,
        redirectUrl: `/affiliate/contract/complete?contractId=${contractId}&type=${contractType}`,
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return NextResponse.json({
      ok: true,
      message: '계약서가 완료되었고 이메일로 전송되었습니다.',
      emailSent: true,
      redirectUrl: `/affiliate/contract/complete?contractId=${contractId}&type=${contractType}`,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error(`[Admin Contract Complete] error:`, error);
    return NextResponse.json(
      { ok: false, message: error.message || '계약서 완료 처리 중 오류가 발생했습니다.' },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
