export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { CreateDeltaCampaignSchema, type CreateDeltaCampaignData } from '@/schemas/campaign';
import deltaSequence from '@/data/delta_sms_sequence.json';

/**
 * GET /api/campaigns/delta/[campaignId] — Delta SMS 설정 조회
 * (별도 파일에서 관리)
 */

/**
 * POST /api/campaigns/delta — Delta SMS 렌탈 캠페인 설정 생성
 *
 * 요청:
 * {
 *   campaignId: string;
 *   triggerType?: "PURCHASE" | "ABANDONED";
 *   deltaDay0Message?: string;
 *   deltaDay1Message?: string;
 *   deltaDay2Message?: string;
 *   deltaDay3Message?: string;
 * }
 *
 * 응답:
 * {
 *   ok: true;
 *   deltaCampaignConfigId: string;
 *   campaignId: string;
 *   triggerType: string;
 *   messages: [
 *     { day: 0, content: string },
 *     { day: 1, content: string },
 *     { day: 2, content: string },
 *     { day: 3, content: string? }
 *   ];
 * }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await req.json();
    const validation = CreateDeltaCampaignSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues.map((issue) => [
          issue.path.join('.'),
          issue.message,
        ])
      );
      logger.warn('[POST /api/campaigns/delta] Validation failed', { orgId, errors: fieldErrors });
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '입력값 검증에 실패했습니다.', errors: fieldErrors },
        { status: 400 }
      );
    }

    const data = validation.data as CreateDeltaCampaignData;

    // ===== Step 1: 캠페인 존재 및 권한 확인 (IDOR 방지)
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: data.campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        sendSms: true,
        title: true,
      },
    });

    if (!campaign) {
      logger.warn('[POST /api/campaigns/delta] Campaign not found or access denied', {
        orgId,
        campaignId: data.campaignId,
      });
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ===== Step 2: 캠페인 상태 검증 (DRAFT만 가능)
    if (campaign.status !== 'DRAFT') {
      logger.warn('[POST /api/campaigns/delta] Campaign not in DRAFT status', {
        orgId,
        campaignId: data.campaignId,
        status: campaign.status,
      });
      return NextResponse.json(
        { ok: false, error: 'INVALID_STATE', message: '작성 중(DRAFT) 상태의 캠페인에서만 설정할 수 있습니다.' },
        { status: 400 }
      );
    }

    // ===== Step 3: SMS 발송 채널 확인
    if (!campaign.sendSms) {
      logger.warn('[POST /api/campaigns/delta] SMS not enabled for campaign', {
        orgId,
        campaignId: data.campaignId,
      });
      return NextResponse.json(
        { ok: false, error: 'INVALID_STATE', message: 'SMS 발송이 활성화된 캠페인에서만 Delta SMS를 설정할 수 있습니다.' },
        { status: 400 }
      );
    }

    // ===== Step 4: 기본 메시지 로드
    const triggerType = data.triggerType || 'PURCHASE';
    const triggerConfig = deltaSequence.triggers[triggerType as keyof typeof deltaSequence.triggers];

    if (!triggerConfig) {
      logger.error('[POST /api/campaigns/delta] Invalid trigger type in sequence data', {
        orgId,
        triggerType,
      });
      return NextResponse.json(
        { ok: false, error: 'SERVER_ERROR', message: '지정된 트리거 타입을 지원하지 않습니다.' },
        { status: 500 }
      );
    }

    // ===== Step 5: 메시지 준비 (기본값 사용 또는 커스텀 override)
    const messages = {
      day0: data.deltaDay0Message || triggerConfig.days[0].message,
      day1: data.deltaDay1Message || triggerConfig.days[1].message,
      day2: data.deltaDay2Message || triggerConfig.days[2].message,
      day3: data.deltaDay3Message || triggerConfig.days[3].message,
    };

    // ===== Step 6: Zod 재검증 (문자 길이)
    const dayLimits = {
      day0: 90,
      day1: 160,
      day2: 160,
      day3: 160,
    };

    for (const [day, limit] of Object.entries(dayLimits)) {
      if (messages[day as keyof typeof messages].length > limit) {
        logger.warn('[POST /api/campaigns/delta] Message exceeds character limit', {
          orgId,
          campaignId: data.campaignId,
          day,
          limit,
          actual: messages[day as keyof typeof messages].length,
        });
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: `${day} 메시지가 ${limit}자를 초과합니다.` },
          { status: 400 }
        );
      }
    }

    // ===== Step 7: DeltaCampaignConfig upsert (campaignId unique)
    const deltaConfig = await prisma.deltaCampaignConfig.upsert({
      where: {
        campaignId: data.campaignId,
      },
      update: {
        triggerType,
        day0Message: messages.day0,
        day1Message: messages.day1,
        day2Message: messages.day2,
        day3Message: messages.day3,
        updatedAt: new Date(),
      },
      create: {
        campaignId: data.campaignId,
        organizationId: orgId,
        triggerType,
        day0Message: messages.day0,
        day1Message: messages.day1,
        day2Message: messages.day2,
        day3Message: messages.day3,
      },
      select: {
        id: true,
        campaignId: true,
        triggerType: true,
        day0Message: true,
        day1Message: true,
        day2Message: true,
        day3Message: true,
      },
    });

    // ===== Step 8: SendingHistory 테이블에 Delta SMS 플래그 설정
    // (향후 발송 시 이 플래그를 사용하여 자동 시퀀스 활성화)
    // NOTE: SendingHistory는 발송 시점에 생성되므로 여기서는 로깅만 수행
    logger.log('[POST /api/campaigns/delta] DeltaCampaignConfig upserted', {
      orgId,
      campaignId: data.campaignId,
      configId: deltaConfig.id,
      triggerType,
    });

    // ===== Step 9: 응답 생성
    // P0 2: organizationId 포함 (클라이언트에서 IDOR 재검증 가능)
    const responseMessages = [
      { day: 0, content: deltaConfig.day0Message },
      { day: 1, content: deltaConfig.day1Message },
      { day: 2, content: deltaConfig.day2Message },
      { day: 3, content: deltaConfig.day3Message || null },
    ].filter(m => m.content !== null);

    return NextResponse.json(
      {
        ok: true,
        deltaCampaignConfigId: deltaConfig.id,
        campaignId: deltaConfig.campaignId,
        organizationId: orgId,
        triggerType: deltaConfig.triggerType,
        messages: responseMessages,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/campaigns/delta]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
