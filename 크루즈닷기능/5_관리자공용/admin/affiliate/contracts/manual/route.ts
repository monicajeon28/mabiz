// app/api/admin/affiliate/contracts/manual/route.ts
// 수동 계약서 생성 API

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const body = await req.json();
    const {
      name,
      phone,
      email,
      residentId,
      address,
      bankName,
      bankAccount,
      bankAccountHolder,
      idCardPath,
      idCardOriginalName,
      bankbookPath,
      bankbookOriginalName,
      signatureUrl,
      signatureOriginalName,
      signatureFileId,
      signatureLink,
      signatureLinkExpiresAt,
      contractStartDate,
      contractEndDate,
      consentPrivacy,
      consentNonCompete,
      consentDbUse,
      consentPenalty,
      notes,
      contractType,
      status = 'submitted',
    } = body;

    // 필수 항목 검증
    if (!name || !phone || !residentId || !address) {
      return NextResponse.json(
        { ok: false, message: '필수 항목(이름, 전화번호, 주민등록번호, 주소)을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!consentPrivacy || !consentNonCompete || !consentDbUse || !consentPenalty) {
      return NextResponse.json(
        { ok: false, message: '모든 필수 동의 항목에 체크해주세요.' },
        { status: 400 }
      );
    }

    // 정액제 판매원의 경우 계약 기간 자동 설정 (1개월)
    let finalContractStartDate = contractStartDate ? new Date(contractStartDate) : null;
    let finalContractEndDate = contractEndDate ? new Date(contractEndDate) : null;
    
    if (contractType === 'SUBSCRIPTION_AGENT') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (!finalContractStartDate) {
        finalContractStartDate = today;
      }
      
      if (!finalContractEndDate) {
        // 1개월 후 종료
        finalContractEndDate = new Date(today);
        finalContractEndDate.setMonth(finalContractEndDate.getMonth() + 1);
      }
    }

    // 계약서 생성
    const contract = await prisma.affiliateContract.create({
      data: {
        name,
        phone,
        email: email || null,
        residentId,
        address,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        bankAccountHolder: bankAccountHolder || null,
        idCardPath: idCardPath || null,
        idCardOriginalName: idCardOriginalName || null,
        bankbookPath: bankbookPath || null,
        bankbookOriginalName: bankbookOriginalName || null,
        signatureUrl: signatureUrl || null,
        signatureOriginalName: signatureOriginalName || null,
        signatureFileId: signatureFileId || null,
        signatureLink: signatureLink || null,
        signatureLinkExpiresAt: signatureLinkExpiresAt ? new Date(signatureLinkExpiresAt) : null,
        contractStartDate: finalContractStartDate,
        contractEndDate: finalContractEndDate,
        consentPrivacy: !!consentPrivacy,
        consentNonCompete: !!consentNonCompete,
        consentDbUse: !!consentDbUse,
        consentPenalty: !!consentPenalty,
        notes: notes || null,
        status,
        metadata: {
          contractType: contractType || 'SALES_AGENT',
          createdBy: 'admin',
          createdByUserId: sessionUser.id,
          manualEntry: true,
          // 정액제 판매원의 경우 추가 정보 저장
          ...(contractType === 'SUBSCRIPTION_AGENT' && {
            subscriptionPlan: 'monthly',
            totalMonths: 1,
            nextBillingDate: finalContractEndDate ? finalContractEndDate.toISOString() : null,
          }),
        },
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.log('[admin/affiliate/contracts/manual][POST] Contract created:', {
      contractId: contract.id,
      name: contract.name,
      phone: contract.phone,
      contractType,
    });

    return NextResponse.json({
      ok: true,
      contract,
      message: '계약서가 성공적으로 생성되었습니다.',
    });
  } catch (error) {
    logger.error('[admin/affiliate/contracts/manual][POST] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: '계약서 생성 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}


