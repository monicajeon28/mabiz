export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/campaigns/delta/[campaignId] — Delta SMS 설정 조회
 *
 * 응답:
 * {
 *   ok: true;
 *   deltaConfig: {
 *     id: string;
 *     campaignId: string;
 *     triggerType: string;
 *     day0Message: string;
 *     day1Message: string;
 *     day2Message: string;
 *     day3Message: string | null;
 *     isActive: boolean;
 *   };
 * }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const { campaignId } = await params;

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '캠페인 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    // ===== Step 1: 캠페인 권한 확인
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!campaign) {
      logger.warn('[GET /api/campaigns/delta/[campaignId]] Campaign not found or access denied', {
        orgId,
        campaignId,
      });
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ===== Step 2: Delta SMS 설정 조회
    const deltaConfig = await prisma.deltaCampaignConfig.findUnique({
      where: { campaignId },
      select: {
        id: true,
        campaignId: true,
        triggerType: true,
        day0Message: true,
        day1Message: true,
        day2Message: true,
        day3Message: true,
        isActive: true,
      },
    });

    if (!deltaConfig) {
      logger.info('[GET /api/campaigns/delta/[campaignId]] No Delta config found', {
        orgId,
        campaignId,
      });
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Delta SMS 설정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    logger.log('[GET /api/campaigns/delta/[campaignId]]', {
      orgId,
      campaignId,
      triggerType: deltaConfig.triggerType,
    });

    return NextResponse.json({
      ok: true,
      deltaConfig,
    });
  } catch (err) {
    logger.error('[GET /api/campaigns/delta/[campaignId]]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/campaigns/delta/[campaignId] — Delta SMS 설정 수정
 *
 * 요청:
 * {
 *   triggerType?: "PURCHASE" | "ABANDONED";
 *   deltaDay0Message?: string;
 *   deltaDay1Message?: string;
 *   deltaDay2Message?: string;
 *   deltaDay3Message?: string;
 *   isActive?: boolean;
 * }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '캠페인 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // ===== Step 1: 캠페인 권한 확인
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
      },
    });

    if (!campaign) {
      logger.warn('[PATCH /api/campaigns/delta/[campaignId]] Campaign not found or access denied', {
        orgId,
        campaignId,
      });
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ===== Step 2: 캠페인 상태 검증 (DRAFT만 수정 가능)
    if (campaign.status !== 'DRAFT') {
      logger.warn('[PATCH /api/campaigns/delta/[campaignId]] Campaign not in DRAFT status', {
        orgId,
        campaignId,
        status: campaign.status,
      });
      return NextResponse.json(
        { ok: false, error: 'INVALID_STATE', message: '작성 중(DRAFT) 상태의 캠페인에서만 수정할 수 있습니다.' },
        { status: 400 }
      );
    }

    // ===== Step 3: Delta SMS 설정 조회
    const deltaConfig = await prisma.deltaCampaignConfig.findUnique({
      where: { campaignId },
    });

    if (!deltaConfig) {
      logger.warn('[PATCH /api/campaigns/delta/[campaignId]] Delta config not found', {
        orgId,
        campaignId,
      });
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Delta SMS 설정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ===== Step 4: 메시지 길이 검증
    const dayLimits = {
      deltaDay0Message: 90,
      deltaDay1Message: 160,
      deltaDay2Message: 160,
      deltaDay3Message: 160,
    };

    for (const [field, limit] of Object.entries(dayLimits)) {
      if (body[field] && body[field].length > limit) {
        logger.warn('[PATCH /api/campaigns/delta/[campaignId]] Message exceeds character limit', {
          orgId,
          campaignId,
          field,
          limit,
          actual: body[field].length,
        });
        return NextResponse.json(
          { ok: false, error: 'INVALID_INPUT', message: `${field}가 ${limit}자를 초과합니다.` },
          { status: 400 }
        );
      }
    }

    // ===== Step 5: 설정 업데이트
    const updateData: any = {};
    if (body.triggerType) updateData.triggerType = body.triggerType;
    if (body.deltaDay0Message) updateData.day0Message = body.deltaDay0Message;
    if (body.deltaDay1Message) updateData.day1Message = body.deltaDay1Message;
    if (body.deltaDay2Message) updateData.day2Message = body.deltaDay2Message;
    if (body.deltaDay3Message) updateData.day3Message = body.deltaDay3Message;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updatedConfig = await prisma.deltaCampaignConfig.update({
      where: { campaignId },
      data: updateData,
      select: {
        id: true,
        campaignId: true,
        triggerType: true,
        day0Message: true,
        day1Message: true,
        day2Message: true,
        day3Message: true,
        isActive: true,
      },
    });

    logger.log('[PATCH /api/campaigns/delta/[campaignId]]', {
      orgId,
      campaignId,
      updatedFields: Object.keys(updateData),
    });

    return NextResponse.json({
      ok: true,
      deltaConfig: updatedConfig,
    });
  } catch (err) {
    logger.error('[PATCH /api/campaigns/delta/[campaignId]]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
