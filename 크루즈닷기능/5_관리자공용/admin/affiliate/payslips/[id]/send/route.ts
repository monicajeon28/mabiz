export const dynamic = 'force-dynamic';

// POST /api/admin/affiliate/payslips/[id]/send
// 지급명세서 개별 발송 — status → SENT, sentAt = now(), AdminNotification 생성
// 사전 조건: status IN ('PENDING', 'APPROVED') — 이미 SENT이면 409

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCsrfToken, getCsrfErrorResponse } from '@/lib/utils/csrfValidation';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const csrfValidation = validateCsrfToken(_req);
    if (!csrfValidation.valid) {
      return getCsrfErrorResponse(csrfValidation.error || '잘못된 요청입니다.');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    if (!dbUser || !['admin', 'superadmin'].includes(dbUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const payslipId = parseInt(params.id, 10);
    if (isNaN(payslipId)) {
      return NextResponse.json({ ok: false, error: '올바른 payslip ID가 아닙니다.' }, { status: 400 });
    }

    // APPROVED 상태만 발송 가능 (TOCTOU 방어: updateMany로 원자적 처리)
    const now = new Date();
    const result = await prisma.affiliatePayslip.updateMany({
      where: {
        id: payslipId,
        status: 'APPROVED', // PENDING은 발송 불가, SENT는 재발송 불가
      },
      data: {
        status: 'SENT',
        sentAt: now,
        updatedAt: now,
      },
    });

    if (result.count === 0) {
      // APPROVED가 아닌 상태이거나 존재하지 않음 — 상태 확인 후 명확한 에러 반환
      const existing = await prisma.affiliatePayslip.findUnique({
        where: { id: payslipId },
        select: { id: true, status: true, sentAt: true },
      });
      if (!existing) {
        return NextResponse.json({ ok: false, error: '지급명세서를 찾을 수 없습니다.' }, { status: 404 });
      }
      if (existing.status === 'SENT') {
        return NextResponse.json(
          { ok: false, error: '이미 발송된 명세서입니다.', sentAt: existing.sentAt?.toISOString() },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { ok: false, error: '승인된 명세서만 발송할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 발송 완료된 payslip 조회 (파트너 userId 확인용)
    const payslip = await prisma.affiliatePayslip.findUnique({
      where: { id: payslipId },
      select: {
        id: true,
        period: true,
        sentAt: true,
        netPayment: true,
        AffiliateProfile: {
          select: {
            userId: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
          },
        },
      },
    });

    const partnerName = payslip?.AffiliateProfile?.displayName ?? payslip?.AffiliateProfile?.nickname ?? '파트너';
    const partnerUserId = payslip?.AffiliateProfile?.userId ?? null;

    // AdminNotification 생성 (파트너 userId 포함)
    await prisma.adminNotification.create({
      data: {
        userId: partnerUserId,
        notificationType: 'PAYSLIP_SENT',
        title: '지급명세서 발송 완료',
        content: `${payslip?.period} 지급명세서가 ${partnerName}님께 발송되었습니다. (세후 ${(payslip?.netPayment ?? 0).toLocaleString()}원)`,
        priority: 'normal',
        isRead: false,
        metadata: {
          payslipId,
          period: payslip?.period,
          sentAt: now.toISOString(),
          sentByUserId: sessionUser.id,
        },
      },
    });

    logger.debug('[Admin Payslips] 개별 발송 완료', {
      payslipId,
      period: payslip?.period,
      partnerCode: payslip?.AffiliateProfile?.affiliateCode,
      sentByUserId: sessionUser.id,
    });

    return NextResponse.json({
      ok: true,
      payslipId,
      sentAt: now.toISOString(),
    });
  } catch (error: unknown) {
    logger.error('[Admin Payslips] 개별 발송 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
