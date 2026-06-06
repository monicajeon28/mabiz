export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requirePartnerContext, canAccessLead } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { buildPassportLink } from '@/lib/passport-utils';

function maskPhone(phone: string | null): string {
  if (!phone) return '(null)';
  if (phone.length <= 4) return '****';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');

  if (digits.length === 11 && digits.startsWith('010')) {
    return digits;
  }

  if (digits.length === 10) {
    return `0${digits}`;
  }

  if (digits.length === 11 && /^01[0-9]/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * 고객별 여권 제출 링크 생성 (파트너용)
 * POST body: { leadId: number }
 */
export async function POST(req: NextRequest) {
  try {
    logger.log('[PartnerPassportLink] POST 요청 시작');

    const partnerCtx = await requirePartnerContext();
    if (!partnerCtx) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 403 },
      );
    }

    const { sessionUser, profile } = partnerCtx;
    const body = await req.json();
    const leadId = Number(body.leadId);

    if (isNaN(leadId) || leadId <= 0) {
      logger.error('[PartnerPassportLink] 유효하지 않은 leadId:', { leadId });
      return NextResponse.json(
        { ok: false, message: '유효한 고객 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    // 권한 확인: 본인의 고객인지 확인
    const hasAccess = await canAccessLead(partnerCtx, leadId);
    if (!hasAccess) {
      return NextResponse.json(
        { ok: false, message: '이 고객에 대한 접근 권한이 없습니다.' },
        { status: 403 },
      );
    }

    // 고객 정보 조회
    const lead = await prisma.gmAffiliateLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        passportRequestedAt: true,
        managerId: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, message: '고객을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // managerId를 통해 연결된 User 조회
    const leadUser = lead.managerId
      ? await prisma.gmUser.findUnique({
          where: { id: lead.managerId },
          select: { id: true, name: true, phone: true },
        })
      : null;

    if (!leadUser) {
      return NextResponse.json(
        { ok: false, message: '해당 고객은 아직 회원 정보와 연결되지 않았습니다.' },
        { status: 400 },
      );
    }

    // 여권 제출 토큰 생성
    const token = randomBytes(16).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72시간
    const link = buildPassportLink(token);

    // 기존 제출이 있으면 업데이트, 없으면 생성
    const existingSubmission = await prisma.gmPassportSubmission.findFirst({
      where: {
        userId: leadUser.id,
        isSubmitted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    let submissionId: number;

    if (existingSubmission) {
      const updated = await prisma.gmPassportSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          token, // ✅ P0 FIX: 새 토큰 할당
          tokenExpiresAt,
          isSubmitted: false,
          updatedAt: new Date(),
          extraData: Prisma.JsonNull,
        },
      });
      submissionId = updated.id;
    } else {
      const created = await prisma.gmPassportSubmission.create({
        data: {
          userId: leadUser.id,
          token,
          tokenExpiresAt,
          isSubmitted: false,
          driveFolderUrl: null,
          extraData: Prisma.JsonNull,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      submissionId = created.id;
    }

    // 여권 요청 시간 업데이트
    await prisma.gmAffiliateLead.update({
      where: { id: leadId },
      data: {
        passportRequestedAt: new Date(),
      },
    });

    // PassportRequestLog 생성
    // ✅ L6 심리학 (타이밍 손실회피): 기한 임박 메시지로 긴박감 조성
    const hoursRemaining = 72;
    const messageBody = existingSubmission
      ? `[재제출] 여권 재제출 링크: ${link}\n⏰ 기한 임박: ${hoursRemaining}시간 남음\n놓치지 마세요!`
      : `여권 제출 링크: ${link}\n📋 제출 기한: ${hoursRemaining}시간`;

    await prisma.gmPassportRequestLog.create({
      data: {
        userId: leadUser.id,
        adminId: sessionUser.id,
        templateId: null,
        messageBody,
        messageChannel: 'LINK',
        status: 'SUCCESS',
        errorReason: null,
        sentAt: new Date(),
      },
    });

    logger.log('[PartnerPassportLink] 링크 생성 성공:', {
      leadId,
      userId: leadUser.id,
      submissionId,
    });

    return NextResponse.json({
      ok: true,
      link,
      submissionId,
      expiresAt: tokenExpiresAt.toISOString(),
      message: '여권 제출 링크가 생성되었습니다.',
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[PartnerPassportLink] POST error:', {
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      {
        ok: false,
        message: '여권 제출 링크 생성에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}
