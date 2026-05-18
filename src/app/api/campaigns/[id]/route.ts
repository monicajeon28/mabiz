export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { CampaignUpdateSchema, type CampaignUpdateData } from '@/schemas/campaign';
import type { CrmMarketingCampaign } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

/**
 * 캠페인 객체 직렬화 헬퍼
 */
const serializeCampaign = (campaign: any) => ({
  id: campaign.id,
  title: campaign.title,
  status: campaign.status,
  sendSms: campaign.sendSms,
  sendEmail: campaign.sendEmail,
  sendAt: campaign.sendAt,
  repeatRule: campaign.repeatRule,
  sentCount: campaign.sentCount,
  totalCount: campaign.totalCount,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});

// ============================================================================
// PATCH /api/campaigns/[id] — 캠페인 수정
// ============================================================================
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: campaignId } = await params;

    const body = await req.json();
    const validation = CampaignUpdateSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues.map((issue) => [
          issue.path.join('.'),
          issue.message,
        ])
      );
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '입력값 검증에 실패했습니다.', errors: fieldErrors },
        { status: 400 }
      );
    }

    // ✅ IDOR 보안: organizationId 체크 및 캠페인 존재 확인
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        sendSms: true,
        sendEmail: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ✅ DRAFT 상태만 수정 가능
    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_STATE', message: '발송 준비 중 이상의 캠페인은 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const data = validation.data as Partial<CampaignUpdateData>;

    // SEC-004: 화이트리스트 검증
    const allowedFields = [
      'title',
      'sendSms',
      'smsBody',
      'sendEmail',
      'emailSubject',
      'emailBody',
      'includeLanding',
      'landingUrl',
      'landingLinkText',
      'sendAt',
      'repeatRule',
    ] as const;

    type UpdateData = Pick<CrmMarketingCampaign, typeof allowedFields[number]>;
    const updateData: Partial<UpdateData> = {};

    // title
    if (data.title !== undefined) {
      if (typeof data.title === 'string' && data.title.trim().length > 0) {
        updateData.title = data.title.trim();
      } else if (data.title !== null) {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '캠페인명은 공백이 아닌 문자열이어야 합니다.' },
          { status: 400 }
        );
      }
    }

    // sendSms
    if (data.sendSms !== undefined) {
      updateData.sendSms = data.sendSms;
    }

    // smsBody
    if (data.smsBody !== undefined) {
      if (data.smsBody === null) {
        updateData.smsBody = null;
      } else if (typeof data.smsBody === 'string' && data.smsBody.length <= 1000) {
        updateData.smsBody = data.smsBody;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: 'SMS 본문은 1000자 이하여야 합니다.' },
          { status: 400 }
        );
      }
    }

    // sendEmail
    if (data.sendEmail !== undefined) {
      updateData.sendEmail = data.sendEmail;
    }

    // emailSubject
    if (data.emailSubject !== undefined) {
      if (data.emailSubject === null) {
        updateData.emailSubject = null;
      } else if (typeof data.emailSubject === 'string' && data.emailSubject.length <= 200) {
        updateData.emailSubject = data.emailSubject;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '이메일 제목은 200자 이하여야 합니다.' },
          { status: 400 }
        );
      }
    }

    // emailBody
    if (data.emailBody !== undefined) {
      if (data.emailBody === null) {
        updateData.emailBody = null;
      } else if (typeof data.emailBody === 'string' && data.emailBody.length <= 5000) {
        updateData.emailBody = data.emailBody;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '이메일 본문은 5000자 이하여야 합니다.' },
          { status: 400 }
        );
      }
    }

    // includeLanding
    if (data.includeLanding !== undefined) {
      updateData.includeLanding = data.includeLanding;
    }

    // landingUrl
    if (data.landingUrl !== undefined) {
      if (data.landingUrl === null) {
        updateData.landingUrl = null;
      } else if (typeof data.landingUrl === 'string') {
        try {
          new URL(data.landingUrl);
          updateData.landingUrl = data.landingUrl;
        } catch {
          return NextResponse.json(
            { ok: false, error: 'INVALID_INPUT', message: '유효한 URL 형식이어야 합니다.' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '랜딩 URL은 문자열 또는 null이어야 합니다.' },
          { status: 400 }
        );
      }
    }

    // landingLinkText
    if (data.landingLinkText !== undefined) {
      if (data.landingLinkText === null) {
        updateData.landingLinkText = null;
      } else if (typeof data.landingLinkText === 'string' && data.landingLinkText.length <= 100) {
        updateData.landingLinkText = data.landingLinkText;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '랜딩 링크 텍스트는 100자 이하여야 합니다.' },
          { status: 400 }
        );
      }
    }

    // sendAt
    if (data.sendAt !== undefined) {
      if (typeof data.sendAt === 'string') {
        const sendAt = new Date(data.sendAt);
        if (isNaN(sendAt.getTime())) {
          return NextResponse.json(
            { ok: false, error: 'INVALID_INPUT', message: '유효한 ISO 8601 datetime 형식이어야 합니다.' },
            { status: 400 }
          );
        }
        if (sendAt <= new Date()) {
          return NextResponse.json(
            { ok: false, error: 'INVALID_INPUT', message: '발송 시간은 현재 시간보다 이후여야 합니다.' },
            { status: 400 }
          );
        }
        updateData.sendAt = sendAt;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '발송 시간은 ISO 8601 문자열이어야 합니다.' },
          { status: 400 }
        );
      }
    }

    // repeatRule
    if (data.repeatRule !== undefined) {
      if (data.repeatRule === null) {
        updateData.repeatRule = null;
      } else if (
        typeof data.repeatRule === 'string' &&
        ['ONCE', 'WEEKLY_MON', 'WEEKLY_WED', 'WEEKLY_FRI', 'MONTHLY_1', 'MONTHLY_15'].includes(data.repeatRule)
      ) {
        updateData.repeatRule = data.repeatRule;
      } else {
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: '유효한 반복 규칙을 선택해주세요.' },
          { status: 400 }
        );
      }
    }

    // ✅ 최소한 하나의 채널은 활성화되어야 함
    const finalSendSms = updateData.sendSms !== undefined ? updateData.sendSms : campaign.sendSms;
    const finalSendEmail = updateData.sendEmail !== undefined ? updateData.sendEmail : campaign.sendEmail;

    if (!finalSendSms && !finalSendEmail) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '최소한 SMS 또는 이메일 중 하나를 활성화해야 합니다.' },
        { status: 400 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'NO_UPDATE', message: '변경할 필드가 없습니다.' },
        { status: 400 }
      );
    }

    const updated = await prisma.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: updateData,
      select: {
        id: true,
        title: true,
        status: true,
        sendSms: true,
        sendEmail: true,
        sendAt: true,
        repeatRule: true,
        sentCount: true,
        totalCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.log('[PATCH /api/campaigns/[id]]', { campaignId, updated: Object.keys(updateData) });

    return NextResponse.json({
      ok: true,
      campaign: serializeCampaign(updated),
    });
  } catch (err) {
    logger.error('[PATCH /api/campaigns/[id]]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/campaigns/[id] — 캠페인 삭제
// ============================================================================
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: campaignId } = await params;

    // ✅ IDOR 보안: organizationId 체크 및 캠페인 존재 확인
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ✅ DRAFT 상태만 삭제 가능
    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_STATE', message: '발송 준비 중 이상의 캠페인은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 캠페인 삭제
    await prisma.crmMarketingCampaign.delete({
      where: { id: campaignId },
    });

    logger.log('[DELETE /api/campaigns/[id]]', { campaignId });

    return NextResponse.json({
      ok: true,
      message: '캠페인이 삭제되었습니다.',
    });
  } catch (err) {
    logger.error('[DELETE /api/campaigns/[id]]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
