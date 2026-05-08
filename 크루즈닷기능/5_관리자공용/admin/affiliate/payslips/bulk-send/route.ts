export const dynamic = 'force-dynamic';

// POST /api/admin/affiliate/payslips/bulk-send
// Body: { period: 'YYYY-MM', type?: 'SALES_AGENT'|'BRANCH_MANAGER'|'FREE_SALES_AGENT' }
// status != 'SENT' 전체 → SENT 처리 (일괄 발송)
// 반환: { ok, sent, skipped, period }

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { validateCsrfToken, getCsrfErrorResponse } from '@/lib/utils/csrfValidation';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const csrfValidation = validateCsrfToken(req);
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

    const body = await req.json();
    const { period, type } = body as { period?: string; type?: string };

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { ok: false, error: 'period는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // APPROVED 상태 미발송 payslip 조회 (PENDING은 어드민 승인 전 — 발송 제외)
    const candidates = await prisma.affiliatePayslip.findMany({
      where: {
        period,
        status: 'APPROVED',
        ...(type
          ? {
              AffiliateProfile: { type },
            }
          : {}),
      },
      select: {
        id: true,
        netPayment: true,
        AffiliateProfile: {
          select: {
            userId: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
            type: true,
          },
        },
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: 0, period, message: '발송할 지급명세서가 없습니다.' });
    }

    const now = new Date();
    let sent = 0;
    let skipped = 0;

    // 개별 처리 (각각 updateMany로 TOCTOU 방어)
    for (const payslip of candidates) {
      try {
        const result = await prisma.affiliatePayslip.updateMany({
          where: {
            id: payslip.id,
            status: { not: 'SENT' },
          },
          data: {
            status: 'SENT',
            sentAt: now,
            updatedAt: now,
          },
        });

        if (result.count === 0) {
          skipped++;
          continue;
        }

        // AdminNotification 생성
        const partnerName =
          payslip.AffiliateProfile?.displayName ?? payslip.AffiliateProfile?.nickname ?? '파트너';
        const partnerUserId = payslip.AffiliateProfile?.userId ?? null;

        await prisma.adminNotification.create({
          data: {
            userId: partnerUserId,
            notificationType: 'PAYSLIP_SENT',
            title: '지급명세서 발송 완료',
            content: `${period} 지급명세서가 ${partnerName}님께 발송되었습니다. (세후 ${(payslip.netPayment ?? 0).toLocaleString()}원)`,
            priority: 'normal',
            isRead: false,
            metadata: {
              payslipId: payslip.id,
              period,
              sentAt: now.toISOString(),
              sentByUserId: sessionUser.id,
              bulkSend: true,
            },
          },
        });

        sent++;
      } catch (err) {
        logger.error('[Admin Payslips] 일괄 발송 중 개별 오류', {
          payslipId: payslip.id,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped++;
      }
    }

    logger.debug('[Admin Payslips] 일괄 발송 완료', {
      period,
      type: type ?? 'ALL',
      sent,
      skipped,
      sentByUserId: sessionUser.id,
    });

    return NextResponse.json({ ok: true, sent, skipped, period });
  } catch (error: unknown) {
    logger.error('[Admin Payslips] 일괄 발송 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
