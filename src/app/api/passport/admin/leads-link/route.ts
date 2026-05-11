export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { buildPassportLink } from '@/lib/passport-utils';

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

export async function POST(req: NextRequest) {
  try {
    logger.log('[PassportLink] POST 요청 시작');

    const manager = await requireCrmManager();
    if (!manager) {
      logger.warn('[PassportLink] 인증되지 않은 사용자');
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { leadId: leadIdRaw } = body as { leadId?: number | string };

    const leadId = Number(leadIdRaw);
    if (isNaN(leadId) || leadId <= 0) {
      logger.error('[PassportLink] 유효하지 않은 leadId:', { leadIdRaw });
      return NextResponse.json({ ok: false, message: '유효한 고객 ID가 필요합니다.' }, { status: 400 });
    }

    // 고객 정보 조회
    const lead = await prisma.gmAffiliateLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        passportRequestedAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!lead.customerPhone) {
      return NextResponse.json({ ok: false, message: '고객 전화번호가 없습니다.' }, { status: 400 });
    }

    // 전화번호 정규화 (하이픈 제거)
    const normalizedLeadPhone = normalizePhone(lead.customerPhone);
    if (!normalizedLeadPhone) {
      return NextResponse.json({ ok: false, message: '유효한 전화번호 형식이 아닙니다.' }, { status: 400 });
    }

    // 전화번호로 User 찾기 (정규화된 번호로 검색, 여러 형식 시도)
    const userInclude = {
      trips: {
        orderBy: { startDate: 'desc' as const },
        take: 1,
        select: {
          id: true,
          cruiseName: true,
          startDate: true,
          endDate: true,

        },
      },
      passportSubmissions: {
        orderBy: { updatedAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          isSubmitted: true,
          tripId: true,
        },
      },
    };

    // 1. 정규화된 번호로 먼저 시도
    let customerUser = await prisma.gmUser.findFirst({
      where: {
        phone: normalizedLeadPhone,
        role: { not: 'admin' },
      },
      include: userInclude,
    });

    // 2. 정규화된 번호로 찾지 못한 경우, 원본 번호로도 시도
    if (!customerUser) {
      customerUser = await prisma.gmUser.findFirst({
        where: {
          phone: lead.customerPhone,
          role: { not: 'admin' },
        },
        include: userInclude,
      });
    }

    // 3. 여전히 찾지 못한 경우, 하이픈 포함 형식으로도 시도
    if (!customerUser && lead.customerPhone.length === 11 && !lead.customerPhone.includes('-')) {
      const formattedPhone = `${lead.customerPhone.substring(0, 3)}-${lead.customerPhone.substring(3, 7)}-${lead.customerPhone.substring(7)}`;
      customerUser = await prisma.gmUser.findFirst({
        where: {
          phone: formattedPhone,
          role: { not: 'admin' },
        },
        include: userInclude,
      });
    }

    if (!customerUser) {
      return NextResponse.json({ ok: false, message: '고객 사용자를 찾을 수 없습니다. 전화번호로 등록된 사용자가 없습니다.' }, { status: 404 });
    }

    // 여권 제출 토큰 생성
    const token = randomBytes(16).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72시간
    const link = buildPassportLink(token);

    // 기존 제출이 있으면 업데이트, 없으면 생성
    const existingSubmission = customerUser.passportSubmissions[0];
    let submissionId: number;

    if (existingSubmission && !existingSubmission.isSubmitted) {
      const updated = await prisma.gmPassportSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          token,
          tokenExpiresAt,
          tripId: customerUser.trips[0]?.id ?? existingSubmission.tripId,
          isSubmitted: false,
          updatedAt: new Date(),
          extraData: Prisma.JsonNull,
        },
      });
      submissionId = updated.id;
    } else {
      const latestTrip = customerUser.trips[0];
      const createData: Record<string, unknown> = {
        userId: customerUser.id,
        token,
        tokenExpiresAt,
        isSubmitted: false,
        driveFolderUrl: null,
        extraData: Prisma.JsonNull,
        updatedAt: new Date(),
      };

      if (latestTrip?.id) {
        createData.tripId = latestTrip.id;
      }

      const created = await prisma.gmPassportSubmission.create({
        data: createData as any,
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
    await prisma.gmPassportRequestLog.create({
      data: {
        userId: customerUser.id,
        adminId: manager.id,
        templateId: null,
        messageBody: `여권 제출 링크: ${link}`,
        messageChannel: 'LINK',
        status: 'SUCCESS',
        errorReason: null,
        sentAt: new Date(),
      },
    });

    logger.log('[PassportLink] 링크 생성 성공:', {
      leadId,
      userId: customerUser.id,
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
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error(`[PassportLink] POST /api/passport/admin/leads-link error:`, {
      message: err.message,
    });
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : '여권 제출 링크 생성에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
