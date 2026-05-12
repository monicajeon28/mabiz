export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { buildPassportLink } from '@/app/api/admin/passport-request/_utils';
import { requirePartnerContext, getPartnerLead } from '@/app/api/partner/_utils';
import { logger } from '@/lib/logger';

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  // 하이픈, 공백 등 제거
  const digits = phone.replace(/[^0-9]/g, '');
  
  // 010으로 시작하는 11자리 (가장 일반적인 형식)
  if (digits.length === 11 && digits.startsWith('010')) {
    return digits;
  }
  
  // 10자리인 경우 앞에 0 추가
  if (digits.length === 10) {
    return `0${digits}`;
  }
  
  // 11자리이지만 010이 아닌 경우 (011, 016, 017, 018, 019 등)
  if (digits.length === 11 && /^01[0-9]/.test(digits)) {
    return digits;
  }
  
  // 그 외의 경우는 null 반환 (유효하지 않은 형식)
  return null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  try {
    logger.log('[PartnerPassportLink] POST 요청 시작');
    
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const params = await context.params;
    const { leadId: leadIdStr } = params;

    const leadId = Number(leadIdStr);
    if (isNaN(leadId) || leadId <= 0) {
      logger.error('[PartnerPassportLink] 유효하지 않은 leadId:', { leadIdStr, leadId });
      return NextResponse.json({ ok: false, message: '유효한 고객 ID가 필요합니다.' }, { status: 400 });
    }

    // 권한 확인: 본인의 고객인지 확인
    await getPartnerLead(profile.id, leadId, { interactions: 0 }, profile.type);

    // 고객 정보 조회
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        passportRequestedAt: true,
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!lead.User) {
      return NextResponse.json(
        { ok: false, message: '해당 고객은 아직 회원 정보와 연결되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 여권 제출 토큰 생성
    const token = randomBytes(16).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72시간
    const link = buildPassportLink(token);

    // 기존 제출이 있으면 업데이트, 없으면 생성
    const existingSubmission = await prisma.passportSubmission.findFirst({
      where: {
        userId: lead.User.id,
        isSubmitted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    let submissionId: number;

    if (existingSubmission) {
      const updated = await prisma.passportSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          token,
          tokenExpiresAt,
          isSubmitted: false,
          updatedAt: new Date(),
          extraData: Prisma.JsonNull,
        },
      });
      submissionId = updated.id;
    } else {
      const created = await prisma.passportSubmission.create({
        data: {
          User: { connect: { id: lead.User.id } },
          token,
          tokenExpiresAt,
          isSubmitted: false,
          driveFolderUrl: null,
          extraData: Prisma.JsonNull,
          updatedAt: new Date(),
        },
      });
      submissionId = created.id;
    }

    // 여권 요청 시간 업데이트
    await prisma.affiliateLead.update({
      where: { id: leadId },
      data: {
        passportRequestedAt: new Date(),
      },
    });

    // PassportRequestLog 생성
    await prisma.passportRequestLog.create({
      data: {
        userId: lead.User.id,
        adminId: sessionUser.id,
        templateId: null,
        messageBody: `여권 제출 링크: ${link}`,
        messageChannel: 'LINK',
        status: 'SUCCESS',
        errorReason: null,
        sentAt: new Date(),
      },
    });

    logger.log('[PartnerPassportLink] 링크 생성 성공:', {
      leadId,
      userId: lead.User.id,
      submissionId,
      link,
    });

    return NextResponse.json({
      ok: true,
      link,
      token,
      submissionId,
      expiresAt: tokenExpiresAt.toISOString(),
      message: '여권 제출 링크가 생성되었습니다.',
    });
  } catch (error: any) {
    logger.error(`[PartnerPassportLink] POST /api/partner/passport-requests/[leadId]/passport-link error:`, {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        ok: false, 
        message: error instanceof Error ? error.message : '여권 제출 링크 생성에 실패했습니다.' 
      }, 
      { status: 500 }
    );
  }
}


